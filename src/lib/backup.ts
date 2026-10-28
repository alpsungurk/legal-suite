import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { AttachmentRef, ErpState } from "@/lib/erp-types";
import { getAttachment, putAttachmentBlob } from "@/lib/attachments";
import { normalizeState } from "@/lib/migrations";
import { today } from "@/lib/format";
import { listTrashFull } from "@/lib/trash";

function collectAttachmentRefs(state: ErpState): AttachmentRef[] {
  const refs: AttachmentRef[] = [];
  for (const e of state.expenses) refs.push(...e.receipts);
  for (const d of state.documents) refs.push(d.attachment);
  if (state.settings.firm.logo) refs.push(state.settings.firm.logo);
  return refs;
}

/**
 * Tüm veriyi, çöp kutusunu ve ekleri tek bir .zip dosyası olarak indirir:
 *   state.json  tüm kayıtlar (kalan ödemeler dahil)
 *   trash.json  çöp kutusu (silinen kayıtlar bağlılarıyla, geri yükleme verisi dahil)
 *   attachments/  makbuz ve belgeler (çöpteki kayıtlarınkiler dahil)
 *   OKU-BENI.txt  içerik özeti
 */
export async function exportBackup(state: ErpState) {
  let trash: Array<Record<string, unknown>> = [];
  let trashError: string | undefined;
  try {
    trash = await listTrashFull();
  } catch (e) {
    // Çöp kutusu migration'ı uygulanmadıysa tablo yoktur; yedek yine de alınır
    trashError = (e as Error).message;
  }
  const files: Record<string, Uint8Array> = {
    "state.json": strToU8(JSON.stringify(state, null, 2)),
    "trash.json": strToU8(JSON.stringify(trash, null, 2)),
  };
  const ids = new Set(collectAttachmentRefs(state).map((r) => r.id));
  for (const t of trash) {
    const refs = (t.payload as { attachments?: unknown[] } | undefined)?.attachments ?? [];
    for (const id of refs) ids.add(String(id));
  }
  let missing = 0;
  for (const id of ids) {
    const blob = await getAttachment(id);
    if (!blob) {
      missing++;
      continue;
    }
    files[`attachments/${id}`] = new Uint8Array(await blob.arrayBuffer());
  }
  files["OKU-BENI.txt"] = strToU8(
    [
      `LexKasa yedeği · ${today()}`,
      "",
      `Müvekkil: ${state.clients.length} · Dava dosyası: ${state.cases.length} · İcra dosyası: ${state.enforcements.length}`,
      `Masraf: ${state.expenses.length} · Tahsilat planı: ${state.plans.length} · Belge: ${state.documents.length}`,
      `Kalan ödeme: ${state.paymentLedger.length} · Çöp kutusu: ${trash.length}`,
      trashError ? `UYARI: çöp kutusu okunamadı (${trashError})` : "",
      "",
      "state.json    tüm kayıtlar (kalan ödemeler dahil)",
      "trash.json    çöp kutusu: silinen kayıtlar bağlılarıyla, geri yükleme verisi (payload) dahil",
      "attachments/  makbuz ve belgeler (çöpteki kayıtlarınkiler dahil)",
      "",
      "Geri yükleme otomatik değildir. Veri kaybında Supabase panelindeki yedekler",
      "(Database → Backups) ya da destek kullanılır; bu dosya kayıtların kendisini saklar.",
    ].join("\n"),
  );
  const zipped = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(new Blob([zipped.slice().buffer], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `lexkasa-yedek-${today()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return {
    attachments: Object.keys(files).filter((f) => f.startsWith("attachments/")).length,
    trash: trash.length,
    trashError,
    missing,
  };
}

/** Yedek dosyasını okur, ekleri IndexedDB'ye yazar ve yeni state'i döndürür. */
export async function readBackup(file: File): Promise<ErpState> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let json: string;
  let attachments: Record<string, Uint8Array> = {};
  if (file.name.endsWith(".json")) {
    json = strFromU8(buf);
  } else {
    let total = 0;
    const entries = unzipSync(buf, {
      filter: (f) => {
        total += f.originalSize;
        if (total > 1024 * 1024 * 1024) throw new Error("Yedek dosyası beklenenden büyük açılıyor");
        return true;
      },
    });
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
