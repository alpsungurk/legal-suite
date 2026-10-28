/**
 * Duruşma listesini doğrudan .pdf dosyası olarak indirir (yazdırma penceresi açılmaz).
 * jsPDF yalnızca "İndir"e basılınca yüklenir. Türkçe karakterler (ş, ğ, ı, İ) için uygulamanın
 * fontu Inter gömülür (public/fonts, SIL OFL).
 */
import type { FirmProfile } from "@/lib/erp-types";
import { formatDateLong, today } from "@/lib/format";

/** Haftalık duruşma listesi: gün gün; her satırda saat, mahkeme, dosya no, müvekkil, katılacak avukat */
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
const DAY_FILL: [number, number, number] = [232, 238, 247];
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
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf/dist/jspdf.es.min.js"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
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
  const margin = 14;
  let x = margin;
  const top = 14;

  // Başlık: (logo) büro adı ve adresi solda, belge adı ve tarih sağda
  const logo = opts.logoUrl ? await logoPng(opts.logoUrl) : null;
  if (logo) {
    // En fazla 14 mm yükseklik, 45 mm genişlik; oran korunur
    const ratio = logo.w / logo.h;
    const w = Math.min(45, ratio * 14);
    doc.addImage(logo.data, "PNG", x, top, w, w / ratio);
    x += w + 4;
  }
  const firmName = opts.firm.legalName || opts.firm.name;
  doc
    .setFont("Inter", "bold")
    .setFontSize(11)
    .setTextColor(...NAVY);
  doc.text(firmName, x, top + 4.5, { maxWidth: pageW / 2 - 10 });
  doc.setFont("Inter", "normal").setFontSize(8).setTextColor(100);
  const contact = [
    opts.firm.address,
    [opts.firm.phone, opts.firm.email].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
  if (contact) doc.text(contact, x, top + 9, { maxWidth: pageW / 2 - 10 });

  doc
    .setFont("Inter", "bold")
    .setFontSize(13)
    .setTextColor(...NAVY);
  doc.text(opts.title.toLocaleUpperCase("tr"), pageW - margin, top + 5, { align: "right" });
  doc.setFont("Inter", "normal").setFontSize(8).setTextColor(100);
  doc.text(`Düzenleme: ${formatDateLong(today())}`, pageW - margin, top + 10, { align: "right" });

  const lineY = top + 19;
  doc
    .setDrawColor(...NAVY)
    .setLineWidth(0.6)
    .line(margin, lineY, pageW - margin, lineY);
  doc.setFontSize(9).setTextColor(70);
  doc.text(opts.subtitle, margin, lineY + 6);

  autoTable(doc, {
    startY: lineY + 10,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [["Saat", "Mahkeme", "Dosya no", "Müvekkil (sıfatı)", "Katılacak avukat"]],
    // Her günün başında tam genişlikte gün satırı, altında o günün duruşmaları
    body: opts.days.flatMap((d) => [
      [
        {
          content: d.label,
          colSpan: 5,
          styles: { fillColor: DAY_FILL, textColor: NAVY, fontStyle: "bold" as const },
        },
      ],
      ...d.rows.map((r) => [
        { content: r.time, styles: { fontStyle: "bold" as const } },
        r.activity ? `${r.court}\n${r.activity}` : r.court,
        r.caseNo,
        r.detail ? `${r.parties}\n${r.detail}` : r.parties,
        r.excuse ? { content: r.attendee, styles: { textColor: EXCUSE_RED } } : r.attendee,
      ]),
    ]),
    styles: { font: "Inter", fontSize: 8.5, cellPadding: 2, textColor: 30, valign: "top" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 52 },
      2: { cellWidth: 22 },
      4: { cellWidth: 34 },
    },
  });

  // Sayfa numarası
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("Inter", "normal").setFontSize(7.5).setTextColor(130);
    doc.text(
      `${firmName} · ${opts.title} · Sayfa ${i} / ${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }
  doc.save(opts.filename);
}
