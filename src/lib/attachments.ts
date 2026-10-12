/**
 * Dosya ekleri: künye `attachments` tablosunda, içerik Supabase Storage'da.
 */
import type { AttachmentRef } from "@/lib/erp-types";
import { newId } from "@/lib/mappers";
import { supabase } from "@/lib/supabase";

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const BUCKET = "attachments";

async function currentOrgId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum yok");
  const { data, error } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (error || !data) throw new Error("Büro bulunamadı");
  return data.org_id as string;
}

export async function saveAttachment(
  file: Blob & { name?: string },
  opts?: { entity?: "expense" | "document" | "logo"; entityId?: string },
): Promise<AttachmentRef> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Dosya 15 MB'tan büyük olamaz");
  }
  const orgId = await currentOrgId();
  const id = newId();
  const path = `${orgId}/${id}`;
  const mime = file.type || "application/octet-stream";
  const name = file.name ?? "dosya";

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { error: rowErr } = await supabase.from("attachments").insert({
    id,
    name,
    mime,
    size: file.size,
    storage_path: path,
    entity: opts?.entity ?? "document",
    entity_id: opts?.entityId ?? null,
  });
  if (rowErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(rowErr.message);
  }

  return { id, name, mime, size: file.size };
}

/** Yedek geri yükleme için blob'u mevcut id ile yazar (Storage + satır) */
export async function putAttachmentBlob(
  id: string,
  blob: Blob,
  meta?: { name?: string; mime?: string; entity?: "expense" | "document" | "logo"; entityId?: string },
) {
  const orgId = await currentOrgId();
  const path = `${orgId}/${id}`;
  const mime = meta?.mime || blob.type || "application/octet-stream";
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);
  const { error } = await supabase.from("attachments").upsert({
    id,
    name: meta?.name ?? "dosya",
    mime,
    size: blob.size,
    storage_path: path,
    entity: meta?.entity ?? "document",
    entity_id: meta?.entityId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getAttachment(id: string): Promise<Blob | undefined> {
  const { data: row, error } = await supabase
    .from("attachments")
    .select("storage_path, mime")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return undefined;
  const { data, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(row.storage_path as string);
  if (dlErr || !data) return undefined;
  return data;
}

export async function deleteAttachment(id: string) {
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  // Storage object temizliği cron / storage_cleanup kuyruğu ile yapılır
}

export async function listAttachmentIds(): Promise<string[]> {
  const { data, error } = await supabase.from("attachments").select("id");
  if (error) return [];
  return (data ?? []).map((r) => r.id as string);
}

const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function openAttachment(ref: AttachmentRef) {
  const blob = await getAttachment(ref.id);
  if (!blob) throw new Error("Dosya bulunamadı");
  const type = (blob.type || ref.mime || "").toLowerCase();
  if (!VIEWABLE.has(type)) {
    await downloadAttachment(ref);
    return;
  }
  const url = URL.createObjectURL(new Blob([blob], { type }));
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadAttachment(ref: AttachmentRef) {
  const blob = await getAttachment(ref.id);
  if (!blob) throw new Error("Dosya bulunamadı");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ref.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
