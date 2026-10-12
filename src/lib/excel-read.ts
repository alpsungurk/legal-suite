/**
 * Bağımlılıksız .xlsx / .csv okuyucu (fflate ile zip açılır, XML tarayıcıda çözülür).
 * Excel, LibreOffice ve Google E-Tablolar'ın ürettiği dosyalarla uyumludur.
 */
import { strFromU8, unzipSync } from "fflate";

export type RawCell = string | number | boolean | null;
export type RawSheet = { name: string; rows: RawCell[][] };
export type Workbook = { sheets: RawSheet[]; date1904: boolean };

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 150 * 1024 * 1024;
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export async function readSpreadsheet(file: File): Promise<Workbook> {
  if (file.size > MAX_BYTES) throw new Error("Dosya çok büyük (en fazla 20 MB).");
  const name = file.name.toLocaleLowerCase("tr");
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return { sheets: [{ name: "CSV", rows: parseCsv(await file.text()) }], date1904: false };
  }
  if (name.endsWith(".xls")) {
    throw new Error(
      "Eski .xls biçimi okunamıyor. Dosyayı Excel'de Farklı Kaydet > Excel Çalışma Kitabı (.xlsx) olarak kaydedip tekrar deneyin.",
    );
  }
  let entries: Record<string, Uint8Array>;
  try {
    // Küçük dosyada devasa içerik gizleyen "zip bombası"na karşı açılmış boyut sınırı
    let total = 0;
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNZIPPED_BYTES)
          throw new Error("Dosya beklenenden büyük açılıyor; yüklenmedi.");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Dosya beklenenden")) throw e;
    throw new Error("Dosya okunamadı. Geçerli bir .xlsx dosyası seçin.");
  }
  return parseXlsx(entries);
}

/* ───────────── XLSX ───────────── */

function xml(entries: Record<string, Uint8Array>, path: string): Document | null {
  const data = entries[path];
  if (!data) return null;
  const doc = new DOMParser().parseFromString(strFromU8(data), "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
}

/** Ad alanı önekinden bağımsız (ör. `x:row`) öğe arama */
function all(parent: Document | Element, tag: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS("*", tag));
}

function children(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((c) => c.localName === tag);
}

/** `<si>` / `<is>` içindeki metin (fonetik `rPh` hariç) */
function richText(el: Element): string {
  return all(el, "t")
    .filter((t) => t.parentElement?.localName !== "rPh")
    .map((t) => t.textContent ?? "")
    .join("");
}

function colIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, "").toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseXlsx(entries: Record<string, Uint8Array>): Workbook {
  const workbook = xml(entries, "xl/workbook.xml");
  if (!workbook) throw new Error("Dosya okunamadı. Geçerli bir .xlsx dosyası seçin.");
  const pr = all(workbook, "workbookPr")[0];
  const date1904 = ["1", "true"].includes(pr?.getAttribute("date1904") ?? "");

  const rels = new Map<string, string>();
  const relDoc = xml(entries, "xl/_rels/workbook.xml.rels");
  for (const r of relDoc ? all(relDoc, "Relationship") : []) {
    const target = r.getAttribute("Target") ?? "";
    rels.set(
      r.getAttribute("Id") ?? "",
      target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`,
    );
  }

  const sstDoc = xml(entries, "xl/sharedStrings.xml");
  const shared = sstDoc ? all(sstDoc, "si").map(richText) : [];

  const sheets: RawSheet[] = [];
  all(workbook, "sheet").forEach((sh, i) => {
    const rid =
      sh.getAttributeNS(REL_NS, "id") ??
      Array.from(sh.attributes).find((a) => a.name.endsWith(":id"))?.value ??
      "";
    const path = rels.get(rid) ?? `xl/worksheets/sheet${i + 1}.xml`;
    const doc = xml(entries, path);
    if (!doc) return;
    sheets.push({
      name: sh.getAttribute("name") ?? `Sayfa ${i + 1}`,
      rows: readSheet(doc, shared),
    });
  });
  if (!sheets.length) throw new Error("Dosyada okunabilir bir sayfa bulunamadı.");
  return { sheets, date1904 };
}

function readSheet(doc: Document, shared: string[]): RawCell[][] {
  const rows: RawCell[][] = [];
  let nextRow = 0;
  for (const rowEl of all(doc, "row")) {
    const r = Number(rowEl.getAttribute("r"));
    const rowIndex = Number.isFinite(r) && r > 0 ? r - 1 : nextRow;
    nextRow = rowIndex + 1;
    const row: RawCell[] = [];
    let nextCol = 0;
    for (const c of children(rowEl, "c")) {
      const ref = c.getAttribute("r");
      const col = ref ? colIndex(ref) : nextCol;
      nextCol = col + 1;
      row[col] = cellValue(c, shared);
    }
    rows[rowIndex] = Array.from(row, (v) => v ?? null);
  }
  return Array.from(rows, (r) => r ?? []);
}

function cellValue(c: Element, shared: string[]): RawCell {
  const t = c.getAttribute("t") ?? "n";
  const v = children(c, "v")[0]?.textContent ?? null;
  switch (t) {
    case "s":
      return v == null ? null : (shared[Number(v)] ?? null);
    case "inlineStr": {
      const is = children(c, "is")[0];
      return is ? richText(is) : null;
    }
    case "str":
    case "d":
      return v;
    case "b":
      return v === "1";
    case "e":
      return null;
    default: {
      if (v == null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : v;
    }
  }
}

/* ───────────── CSV ───────────── */

export function parseCsv(text: string): RawCell[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: RawCell[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ───────────── Hücre dönüşümleri ───────────── */

/** Excel seri tarihini (1900 veya 1904 sistemi) YYYY-AA-GG'ye çevirir. */
export function excelSerialToISO(serial: number, date1904 = false): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.round(serial) * 86_400_000);
  return d.toISOString().slice(0, 10);
}
