/**
 * Duruşma listesini doğrudan .pdf dosyası olarak indirir (yazdırma penceresi açılmaz).
 * jsPDF yalnızca "İndir"e basılınca yüklenir. Türkçe karakterler (ş, ğ, ı, İ) için uygulamanın
 * fontu Inter gömülür (public/fonts, SIL OFL).
 */
import type { FirmProfile } from "@/lib/erp-types";
import { formatDateLong, today } from "@/lib/format";

/** Haftalık duruşma listesi: günler yan yana, duruşmalar günün altında alt alta */
export type HearingPdfRow = {
  time: string;
  court: string;
  /** Duruşma dışı işlem (Keşif, Ön İnceleme…) mahkemenin altında */
  activity?: string;
  caseNo: string;
  parties: string;
  /** Taraflar / notlar (isteğe bağlı) */
  detail?: string;
  attendee: string;
  /** Mazeret verildiyse katılacak avukat yerine kırmızı yazılır */
  excuse?: boolean;
};
export type HearingPdfDay = { label: string; rows: HearingPdfRow[] };

const NAVY: [number, number, number] = [20, 48, 100];
const EXCUSE_RED: [number, number, number] = [190, 18, 60];

async function fontBase64(url: string) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Logoyu (png, jpg, webp, svg) PNG'ye çevirir; en/boy oranıyla döner */
function logoPng(url: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 100;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve({ data: canvas.toDataURL("image/png"), w, h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function downloadHearingsPdf(opts: {
  title: string;
  subtitle: string;
  firm: FirmProfile;
  /** Verilmezse logosuz */
  logoUrl?: string;
  days: HearingPdfDay[];
  filename: string;
}) {
  const { jsPDF } = await import("jspdf/dist/jspdf.es.min.js");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const [regular, bold] = await Promise.all([
    fontBase64("/fonts/Inter-Regular.ttf"),
    fontBase64("/fonts/Inter-Bold.ttf"),
  ]);
  doc.addFileToVFS("Inter-Regular.ttf", regular);
  doc.addFont("Inter-Regular.ttf", "Inter", "normal");
  doc.addFileToVFS("Inter-Bold.ttf", bold);
  doc.addFont("Inter-Bold.ttf", "Inter", "bold");
  doc.setFont("Inter", "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  let x = margin;
  const top = 8;

  // Başlık: (logo) büro adı ve adresi solda, belge adı ve tarih sağda
  const logo = opts.logoUrl ? await logoPng(opts.logoUrl) : null;
  if (logo) {
    const ratio = logo.w / logo.h;
    const w = Math.min(36, ratio * 10);
    doc.addImage(logo.data, "PNG", x, top, w, w / ratio);
    x += w + 3;
  }
  const firmName = opts.firm.legalName || opts.firm.name;
  doc
    .setFont("Inter", "bold")
    .setFontSize(10)
    .setTextColor(...NAVY);
  doc.text(firmName, x, top + 4, { maxWidth: pageW / 2 - 8 });
  doc.setFont("Inter", "normal").setFontSize(7).setTextColor(100);
  const contact = [opts.firm.address, [opts.firm.phone, opts.firm.email].filter(Boolean).join(" · ")]
    .filter(Boolean)
    .join("\n");
  if (contact) doc.text(contact, x, top + 8, { maxWidth: pageW / 2 - 8 });

  doc
    .setFont("Inter", "bold")
    .setFontSize(12)
    .setTextColor(...NAVY);
  doc.text(opts.title.toLocaleUpperCase("tr"), pageW - margin, top + 4, { align: "right" });
  doc.setFont("Inter", "normal").setFontSize(7.5).setTextColor(100);
  doc.text(`Düzenleme: ${formatDateLong(today())}`, pageW - margin, top + 9, { align: "right" });

  const lineY = top + 16;
  doc
    .setDrawColor(...NAVY)
    .setLineWidth(0.5)
    .line(margin, lineY, pageW - margin, lineY);
  doc.setFontSize(8).setTextColor(70);
  doc.text(opts.subtitle, margin, lineY + 4.2);

  const days = opts.days.length ? opts.days : [{ label: "—", rows: [] }];
  const contentTop = lineY + 7;
  const contentBottom = pageH - 6;
  const avail = contentBottom - contentTop;
  const gap = 1.5;
  const colW = (pageW - margin * 2 - gap * (days.length - 1)) / days.length;
  const inner = colW - 2.2;
  const lineGap = (size: number) => size * 0.36;

  type Seg = { text: string; kind: "time" | "body" | "muted" | "excuse" };
  const wrap = (text: string, size: number) => {
    doc.setFont("Inter", "normal").setFontSize(size);
    return doc.splitTextToSize(text, inner) as string[];
  };
  const segments = (row: HearingPdfRow, size: number): Seg[] => {
    const out: Seg[] = [];
    const add = (text: string | undefined, kind: Seg["kind"], limit?: number) => {
      if (!text?.trim()) return;
      const lines = wrap(text, kind === "muted" ? size - 0.3 : size);
      for (const line of limit ? lines.slice(0, limit) : lines) out.push({ text: line, kind });
    };
    add(row.time, "time");
    add(row.court, "body");
    add(row.activity, "muted");
    add(row.caseNo, "body");
    add(row.parties, "body");
    add(row.detail, "muted", 4);
    add(row.attendee, row.excuse ? "excuse" : "body");
    return out;
  };
  const dayHeight = (day: HearingPdfDay, size: number) => {
    let h = 8;
    if (!day.rows.length) return h + lineGap(size) + 1;
    for (const row of day.rows) h += segments(row, size).length * lineGap(size) + 2.1;
    return h;
  };
  let size = 8;
  while (size > 5.2 && Math.max(...days.map((d) => dayHeight(d, size))) > avail) size -= 0.2;

  days.forEach((day, i) => {
    const colX = margin + i * (colW + gap);
    doc.setFillColor(...NAVY);
    doc.rect(colX, contentTop, colW, 7, "F");
    const [name, date] = day.label.split("\n");
    doc.setFont("Inter", "bold").setFontSize(Math.min(size + 0.4, 8)).setTextColor(255);
    doc.text(name || day.label, colX + colW / 2, contentTop + 2.9, {
      align: "center",
      maxWidth: colW - 1,
    });
    if (date) {
      doc.setFont("Inter", "normal").setFontSize(Math.max(size - 1.1, 5));
      doc.text(date, colX + colW / 2, contentTop + 5.8, { align: "center" });
    }
    let y = contentTop + 9.2;
    if (!day.rows.length) {
      doc.setFont("Inter", "normal").setFontSize(size).setTextColor(140);
      doc.text("Duruşma yok", colX + 1.1, y);
      return;
    }
    for (const row of day.rows) {
      for (const seg of segments(row, size)) {
        const fs = seg.kind === "muted" ? size - 0.3 : size;
        doc.setFont("Inter", seg.kind === "time" ? "bold" : "normal").setFontSize(fs);
        if (seg.kind === "excuse") doc.setTextColor(...EXCUSE_RED);
        else if (seg.kind === "muted") doc.setTextColor(110);
        else if (seg.kind === "time") doc.setTextColor(...NAVY);
        else doc.setTextColor(30);
        doc.text(seg.text, colX + 1.1, y);
        y += lineGap(fs);
      }
      y += 0.4;
      doc.setDrawColor(210).setLineWidth(0.15);
      doc.line(colX + 1, y, colX + colW - 1, y);
      y += 1.5;
    }
  });

  doc.setFont("Inter", "normal").setFontSize(7).setTextColor(130);
  doc.text(`${firmName} · ${opts.title}`, pageW / 2, pageH - 3.5, { align: "center" });
  doc.save(opts.filename);
}
