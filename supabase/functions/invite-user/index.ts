/**
 * Yönetici: kullanıcı davet et / şifre sıfırla.
 * service_role yalnızca burada kullanılır.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Yetkisiz" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Oturum geçersiz" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: caller, error: cErr } = await admin
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", user.id)
      .single();
    if (cErr || !caller || caller.role !== "admin") {
      return json({ error: "Yalnızca yönetici bu işlemi yapabilir" }, 403);
    }

    const body = await req.json();
    const action = body.action ?? "invite";

    if (action === "set_password") {
      const userId = body.userId as string;
      const password = body.password as string;
      if (!userId || !password || password.length < 8) {
        return json({ error: "Geçersiz şifre" }, 400);
      }
      const { data: target } = await admin
        .from("profiles")
        .select("id, org_id")
        .eq("id", userId)
        .single();
      if (!target || target.org_id !== caller.org_id) {
        return json({ error: "Kullanıcı bulunamadı" }, 404);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // invite
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const email = String(body.email ?? "").trim();
    const phone = body.phone ? String(body.phone) : null;
    const title = body.title ? String(body.title) : null;
    const role = body.role === "admin" ? "admin" : "avukat";
    const password = body.password ? String(body.password) : null;

    if (!name || !username || !email) return json({ error: "Eksik alan" }, 400);
    if (!/^[a-z0-9çğıöşü._-]{3,}$/.test(username)) {
      return json({ error: "Geçersiz kullanıcı adı" }, 400);
    }

    let userId: string;

    if (password && password.length >= 8) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !created.user) return json({ error: error?.message ?? "Oluşturulamadı" }, 400);
      userId = created.user.id;
    } else {
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error || !invited.user) return json({ error: error?.message ?? "Davet başarısız" }, 400);
      userId = invited.user.id;
    }

    const { error: pErr } = await admin.from("profiles").insert({
      id: userId,
      org_id: caller.org_id,
      name,
      username,
      email,
      phone,
      title,
      role,
      active: true,
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: pErr.message }, 400);
    }

    const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();

    return json({
      ok: true,
      user: profile
        ? {
            id: profile.id,
            firmId: profile.org_id,
            name: profile.name,
            username: profile.username,
            email: profile.email,
            phone: profile.phone,
            title: profile.title,
            role: profile.role === "admin" ? "Admin" : "Avukat",
            active: profile.active,
            passwordHash: "",
            passwordSalt: "",
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          }
        : null,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
