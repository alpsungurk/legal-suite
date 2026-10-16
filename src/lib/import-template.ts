import { downloadWorkbook, excelColumnName, type ExcelSheet } from "@/lib/excel";
import type { ImportContext, ImportSpec } from "@/lib/import-specs";

export const REQUIRED_MARK = " *";
/** Hatalı satırlar indirilirken eklenen sütun; tekrar yüklendiğinde yok sayılır */
export const ERROR_COLUMN = "Hata (silmeyin, yüklerken yok sayılır)";

/** Şablon düğmesi: hazır şablon dosyası varsa onu, yoksa uygulamanın ürettiğini indirir */
export function downloadTemplate(spec: ImportSpec, ctx: ImportContext) {
  if (!spec.templateFile) return downloadImportTemplate(spec, ctx);
  const a = document.createElement("a");
  a.href = spec.templateFile.url;
  a.download = spec.templateFile.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Doldurulacak şablon: "Veri" sayfası (başlıklar + açılır listeler), açılır listelerin
 * değerlerini tutan "Listeler" sayfası ve her sütunun açıklandığı "Açıklama" sayfası.
 */
export function downloadImportTemplate(spec: ImportSpec, ctx: ImportContext) {
  const listCols = spec.columns
    .map((c, index) => ({ c, index, values: c.options?.(ctx) ?? [] }))
    .filter((x) => x.values.length > 0);

  const listsSheet: ExcelSheet = {
    name: "Listeler",
    columns: listCols.map((x) => ({ header: x.c.header, width: 30 })),
    rows: Array.from({ length: Math.max(0, ...listCols.map((x) => x.values.length)) }, (_, i) =>
      listCols.map((x) => x.values[i] ?? null),
    ),
  };

  const data: ExcelSheet = {
    name: "Veri",
    columns: spec.columns.map((c) => ({
      header: c.required ? c.header + REQUIRED_MARK : c.header,
      width: c.width ?? Math.max(14, c.header.length + 6),
      money: c.type === "money",
    })),
    rows: [],
    validations: listCols.map((x, i) => {
      const col = excelColumnName(i);
      return { col: x.index, source: `'Listeler'!$${col}$2:$${col}$${x.values.length + 1}` };
    }),
  };

  const help: ExcelSheet = {
    name: "Açıklama",
    columns: [
      { header: "Sütun", width: 24 },
      { header: "Zorunlu", width: 10 },
      { header: "Açıklama", width: 70 },
      { header: "Örnek", width: 26 },
    ],
    rows: [
      ...spec.columns.map((c) => [c.header, c.required ? "Evet" : "", c.hint, c.example ?? ""]),
      [],
      ["Nasıl doldurulur?", "", "Her satır bir kayıttır. Başlık satırını değiştirmeyin.", ""],
      ["", "", "* işaretli sütunlar zorunludur. Listeli sütunlarda hücredeki oku kullanın.", ""],
      ["", "", "Tarihler GG.AA.YYYY, tutarlar 1.250,50 biçiminde yazılabilir.", ""],
      ["", "", "Yükledikten sonra her satırı ekranda kontrol edip düzeltebilirsiniz.", ""],
    ],
  };

  downloadWorkbook(`${spec.title} şablonu`, [data, ...(listCols.length ? [listsSheet] : []), help]);
}
