/**
 * Silinen eklerin Storage dosyalarını temizler (public.storage_cleanup sırası).
 * storage.objects'ten SQL ile silme yasak olduğundan Storage API kullanılır.
 * app.cron_storage_cleanup() (haftalık saklama işi) pg_net ile çağırır.
 * Yalnızca sıradaki ve artık hiçbir eke bağlı olmayan yollar silinir; tekrar çağrılması zararsızdır.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUCKET = "attachments";
const BATCH = 100;
const MAX_ROWS = 2000;

Deno.serve(async () => {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: queue, error: qErr } = await admin
      .from("storage_cleanup")
      .select("id, path")
      .order("id")
      .limit(MAX_ROWS);
    if (qErr) return json({ error: qErr.message }, 500);
    if (!queue?.length) return json({ removed: 0, dequeued: 0 });

    let removed = 0;
    let dequeued = 0;
    for (let i = 0; i < queue.length; i += BATCH) {
      const rows = queue.slice(i, i + BATCH);
      const paths = [...new Set(rows.map((r) => r.path as string))];

      // Aynı yol yeniden bir eke bağlandıysa dosyaya dokunma
      const { data: live, error: lErr } = await admin
        .from("attachments")
        .select("storage_path")
        .in("storage_path", paths);
      if (lErr) return json({ error: lErr.message, removed, dequeued }, 500);
      const inUse = new Set((live ?? []).map((r) => r.storage_path as string));
      const toRemove = paths.filter((p) => !inUse.has(p));

      if (toRemove.length) {
        const { data: gone, error: rErr } = await admin.storage.from(BUCKET).remove(toRemove);
        if (rErr) return json({ error: rErr.message, removed, dequeued }, 500);
        removed += gone?.length ?? 0;
      }

      const { error: dErr } = await admin
        .from("storage_cleanup")
        .delete()
        .in("id", rows.map((r) => r.id));
      if (dErr) return json({ error: dErr.message, removed, dequeued }, 500);
      dequeued += rows.length;
    }

    return json({ removed, dequeued });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
