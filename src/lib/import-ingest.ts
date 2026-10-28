/** Excel dosyasını satırlara çevirir (aktarım diyaloğu ve çok sayfalı aktarım ortak kullanır). */
import { readSpreadsheet, type Workbook } from "@/lib/excel-read";
import { cellToText, headerKey, type ImportSpec, type RowValues } from "@/lib/import-specs";
import { ERROR_COLUMN } from "@/lib/import-template";

export const MAX_ROWS = 5000;

/** Satır numarası sütunları: "No", "Sıra", "Sıra No", "S.No", "#" */
const COUNTER_HEADER = /^(no|nr|sira|sirano|sno|siranumarasi|)$/;

export type Row = { id: number; line: number; values: RowValues };

export type FileInfo = {
  name: string;
  sheet: string;
  sheets: string[];
  unknown: string[];
  /** Tanınmayan sütunda kaç dolu hücre var (bu bilgi dosya notuna eklenir) */
  unknownFilled: Record<string, number>;
  /** Sayfadaki dolu veri satırı sayısı */
  dataRows: number;
  missing: string[];
  truncated: boolean;
};

/* ───────────── Dosyayı satırlara çevirme ───────────── */

export async function ingest(source: File | Workbook, spec: ImportSpec, sheetName?: string) {
  const wb = source instanceof File ? await readSpreadsheet(source) : source;
  const exactOf = new Map<string, string>();
  const aliasOf = new Map<string, string>();
  for (const c of spec.columns) {
    exactOf.set(headerKey(c.header), c.key);
    for (const h of c.aliases ?? []) {
      const k = headerKey(h);
      if (!exactOf.has(k) && !aliasOf.has(k)) aliasOf.set(k, c.key);
    }
  }
  const anyKey = (h: string) => exactOf.get(h) ?? aliasOf.get(h);

  // Varsayılan: ilk sayfa (çok sayfalı dosyada kullanıcı seçer)
  const sheet =
    (sheetName ? wb.sheets.find((s) => s.name === sheetName) : undefined) ?? wb.sheets[0];
  if (!sheet) throw new Error("Dosyada sayfa bulunamadı.");

  let headerRow = 0;
  let bestScore = 0;
  sheet.rows.slice(0, 10).forEach((row, i) => {
    const score = new Set(row.map((c) => anyKey(headerKey(String(c ?? "")))).filter(Boolean)).size;
    if (score > bestScore) {
      bestScore = score;
      headerRow = i;
    }
  });
  if (!bestScore)
    throw new Error(
      `"${sheet.name}" sayfasında ${spec.title.toLocaleLowerCase("tr")} sütunları bulunamadı. Başka sayfa seçin veya şablonu indirip doldurun.`,
    );

  const header = sheet.rows[headerRow] ?? [];
  const mapping: Array<{ index: number; key: string }> = [];
  const unknown: string[] = [];
  const unknownCols: Array<{ index: number; header: string }> = [];
  const used = new Set<string>();
  const ignored = new Set((spec.ignoreHeaders ?? []).map(headerKey));
  // 1) Birebir başlık  2) Takma ad (birebir eşleşen sütun öncelikli)
  header.forEach((cell, index) => {
    const text = String(cell ?? "").trim();
    if (!text) return;
    const key = exactOf.get(headerKey(text));
    if (key && !used.has(key)) {
      mapping.push({ index, key });
      used.add(key);
    }
  });
  header.forEach((cell, index) => {
    const text = String(cell ?? "").trim();
    if (!text) return;
    const hk = headerKey(text);
    if (exactOf.has(hk) || ignored.has(hk)) return;
    const key = aliasOf.get(hk);
    if (key && !used.has(key)) {
      mapping.push({ index, key });
      used.add(key);
    } else if (!key && hk !== headerKey(ERROR_COLUMN)) {
      unknown.push(text);
      unknownCols.push({ index, header: text });
    }
  });
  const missing = spec.columns.filter((c) => c.required && !used.has(c.key)).map((c) => c.header);
  const typeOf = new Map(spec.columns.map((c) => [c.key, c.type]));
  const multiOf = new Set(spec.columns.filter((c) => c.multiline).map((c) => c.key));

  const rows: Row[] = [];
  const unknownFilled: Record<string, number> = {};
  const hasNote = spec.columns.some((c) => c.key === "note");
  const data = sheet.rows.slice(headerRow + 1);
  for (let i = 0; i < data.length && rows.length < MAX_ROWS; i++) {
    const raw = data[i] ?? [];
    const values: RowValues = {};
    for (const { index, key } of mapping)
      values[key] = cellToText(raw[index] ?? null, typeOf.get(key), wb.date1904, multiOf.has(key));
    // Tanınmayan sütundaki bilgi kaybolmasın: dosya notuna "Başlık: değer" olarak eklenir
    const extras: string[] = [];
    for (const { index, header } of unknownCols) {
      const text = cellToText(raw[index] ?? null, undefined, wb.date1904, true);
      if (!text) continue;
      // Sıra numarası sütunu (No, Sıra, S.No…) yalnızca sayıysa bilgi taşımaz
      if (COUNTER_HEADER.test(headerKey(header)) && /^\d+$/.test(text)) continue;
      extras.push(`${header}: ${text}`);
      unknownFilled[header] = (unknownFilled[header] ?? 0) + 1;
    }
    if (Object.values(values).every((v) => !v) && !extras.length) continue;
    if (extras.length && hasNote)
      values.note = [values.note, `Ek sütunlar — ${extras.join(" · ")}`].filter(Boolean).join("\n");
    rows.push({ id: i, line: headerRow + i + 2, values });
  }
  const remaining = data
    .slice(rows.length ? rows[rows.length - 1].id + 1 : 0)
    .some((r) => r?.some((c) => c != null && c !== ""));
  const info: FileInfo = {
    name: source instanceof File ? source.name : "",
    sheet: sheet.name,
    sheets: wb.sheets.map((s) => s.name),
    unknown,
    unknownFilled,
    dataRows: data.filter((r) => r?.some((c) => c != null && String(c).trim() !== "")).length,
    missing,
    truncated: rows.length >= MAX_ROWS && remaining,
  };
  return { rows, info };
}
