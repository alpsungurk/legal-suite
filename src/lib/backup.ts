import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { AttachmentRef, ErpState } from "@/lib/erp-types";
import { getAttachment, putAttachmentBlob } from "@/lib/attachments";
import { normalizeState } from "@/lib/migrations";
import { today } from "@/lib/format";

function collectAttachmentRefs(state: ErpState): AttachmentRef[] {
  const refs: AttachmentRef[] = [];
  for (const e of state.expenses) refs.push(...e.receipts);
  for (const d of state.documents) refs.push(d.attachment);
  if (state.settings.firm.logo) refs.push(state.settings.firm.logo);
  return refs;
}

/** Tüm veriyi ve ekleri tek bir .zip dosyası olarak indirir. */
export async function exportBackup(state: ErpState) {
  const files: Record<string, Uint8Array> = {
    "state.json": strToU8(JSON.stringify(state, null, 2)),
  };
  let missing = 0;
  for (const ref of collectAttachmentRefs(state)) {
    const blob = await getAttachment(ref.id);
    if (!blob) {
      missing++;
      continue;
    }
    files[`attachments/${ref.id}`] = new Uint8Array(await blob.arrayBuffer());
  }
  const zipped = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(new Blob([zipped.slice().buffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `lex-yedek-${today()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { attachments: Object.keys(files).length - 1, missing };
}

/** Yedek dosyasını okur, ekleri IndexedDB'ye yazar ve yeni state'i döndürür. */
export async function readBackup(file: File): Promise<ErpState> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let json: string;
  let attachments: Record<string, Uint8Array> = {};
  if (file.name.endsWith(".json")) {
    json = strFromU8(buf);
  } else {
    const entries = unzipSync(buf);
    if (!entries["state.json"]) throw new Error("Geçersiz yedek dosyası: state.json bulunamadı");
    json = strFromU8(entries["state.json"]);
    attachments = entries;
  }
  const parsed = JSON.parse(json) as Partial<ErpState>;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users)) {
    throw new Error("Geçersiz yedek dosyası");
  }
  const state = normalizeState(parsed);
  const mimeById = new Map(collectAttachmentRefs(state).map((r) => [r.id, r.mime]));
  for (const [path, data] of Object.entries(attachments)) {
    if (!path.startsWith("attachments/")) continue;
    const id = path.slice("attachments/".length);
    await putAttachmentBlob(id, new Blob([data.slice().buffer], { type: mimeById.get(id) ?? "" }));
  }
  return state;
}
