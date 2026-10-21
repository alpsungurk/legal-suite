/**
 * OMG icra Excel'ini IMPORT_SPECS ile doğrular (scratchpad).
 * Kullanım: node scripts/icra-import-check.mjs [/path/to.json]
 * JSON: { sheets: [{ name, rows: any[][] }] }  — rd.py / geçici dönüştürücü çıktısı
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const jsonPath = resolve(process.argv[2] || "/tmp/icra-import-check/omg.json");
const wb = JSON.parse(readFileSync(jsonPath, "utf8"));

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const mod = await vite.ssrLoadModule("/src/lib/import-specs.ts");
const { IMPORT_SPECS, headerKey, cellToText, parseAmount } = mod;

const emptyState = (await vite.ssrLoadModule("/src/lib/erp-data.ts")).emptyState;

const state = emptyState();
state.settings.enforcementStatuses = ["Açık", "Durdurulmuş", "Kapalı", "Tahsil edildi"];
state.settings.enforcementTypes = ["İlamsız", "İlamlı", "Kambiyo"];
state.settings.enforcementOffices = [];
state.settings.procedures = [
  { name: "Örnek No: 7", days: 7, action: "Kesinleştirme" },
  { name: "Örnek No: 13", days: 30, action: "Kesinleştirme" },
];
state.settings.enforcementStopReasons = ["Takibe İtiraz"];
state.settings.enforcementCloseReasons = ["İnfaz"];

const ctxBase = {
  state,
  user: { id: "u1", role: "Admin", name: "Test" },
  permissions: { can: () => true },
};

function ingestSheet(sheet, spec) {
  const exactOf = new Map();
  const aliasOf = new Map();
  for (const c of spec.columns) {
    exactOf.set(headerKey(c.header), c.key);
    for (const h of c.aliases ?? []) {
      const k = headerKey(h);
      if (!exactOf.has(k) && !aliasOf.has(k)) aliasOf.set(k, c.key);
    }
  }
  const anyKey = (h) => exactOf.get(h) ?? aliasOf.get(h);
  let headerRow = 0;
  let best = 0;
  sheet.rows.slice(0, 10).forEach((row, i) => {
    const score = new Set(row.map((c) => anyKey(headerKey(String(c ?? "")))).filter(Boolean)).size;
    if (score > best) {
      best = score;
      headerRow = i;
    }
  });
  if (!best) return { rows: [], missing: ["(başlık yok)"] };
  const header = sheet.rows[headerRow] ?? [];
  const mapping = [];
  const used = new Set();
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
    if (exactOf.has(hk)) return;
    const key = aliasOf.get(hk);
    if (key && !used.has(key)) {
      mapping.push({ index, key });
      used.add(key);
    }
  });
  const typeOf = new Map(spec.columns.map((c) => [c.key, c.type]));
  const multiOf = new Set(spec.columns.filter((c) => c.multiline).map((c) => c.key));
  const rows = [];
  for (let i = headerRow + 1; i < sheet.rows.length; i++) {
    const raw = sheet.rows[i] ?? [];
    const values = {};
    for (const { index, key } of mapping)
      values[key] = cellToText(raw[index] ?? null, typeOf.get(key), false, multiOf.has(key));
    if (Object.values(values).every((v) => !v)) continue;
    rows.push({ line: i + 1, values });
  }
  return {
    rows,
    missing: spec.columns.filter((c) => c.required && !used.has(c.key)).map((c) => c.header),
  };
}

const sheets = [
  { name: "Alacaklı olduğumuz dosyalar", kind: "enforcements", company: "" },
  { name: "Borçlu olduğumuz dosyalar", kind: "enforcementsOwed", company: "" },
  { name: "Samyeli ", kind: "enforcements", company: "Samyeli" },
  { name: "AYBEY", kind: "enforcements", company: "AYBEY" },
];

for (const conf of sheets) {
  const sheet = wb.sheets.find((s) => s.name === conf.name);
  if (!sheet) {
    console.log("SAYFA YOK", conf.name);
    continue;
  }
  const spec = IMPORT_SPECS[conf.kind];
  const { rows, missing } = ingestSheet(sheet, spec);
  const ctx = { ...ctxBase, companyClient: conf.company || undefined };
  let err = 0;
  let warn = 0;
  const samples = [];
  for (const r of rows) {
    const check = spec.check(r.values, ctx);
    const nErr = Object.keys(check.errors).length;
    if (nErr) {
      err++;
      if (samples.length < 8)
        samples.push({
          line: r.line,
          errors: check.errors,
          principal: r.values.principal,
          no: r.values.no,
          client: (r.values.client || "").slice(0, 60),
        });
    }
    if (check.warnings.length) warn++;
  }
  console.log(
    `\n=== ${conf.name.trim()} (${conf.kind}${conf.company ? ` · şirket=${conf.company}` : ""}) ===`,
  );
  console.log(
    `satır=${rows.length} hata=${err} uyarı_satırı=${warn} eksik_sütun=${missing.join("|") || "—"}`,
  );
  for (const s of samples) console.log(" ", JSON.stringify(s));
}

// Satır 65 (Excel) özel: Örnek 13 → avukat cevabı 2.642,00-TL
const alacakli = wb.sheets.find((s) => s.name.startsWith("Alacaklı"));
if (alacakli) {
  const cell = alacakli.rows[64]?.[7]; // 0-index row 64 = Excel 65; col H = Takip Çıkış
  console.log(
    "\nSatır 65 çıkış hücresi:",
    JSON.stringify(cell),
    "parseAmount→",
    parseAmount(String(cell ?? "")),
  );
  console.log("2.642,00-TL parseAmount→", parseAmount("2.642,00-TL"));
}

await vite.close();
