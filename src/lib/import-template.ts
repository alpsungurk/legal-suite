import { downloadWorkbook, excelColumnName, type ExcelSheet } from "@/lib/excel";
import { IMPORT_SPECS, type ImportContext, type ImportSpec } from "@/lib/import-specs";

export const REQUIRED_MARK = " *";
/** Hatalı satırlar indirilirken eklenen sütun; tekrar yüklendiğinde yok sayılır */
export const ERROR_COLUMN = "Hata (silmeyin, yüklerken yok sayılır)";

function downloadFile(file: { url: string; filename: string }) {
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type TemplateOption = {
  id: string;
  title: string;
  description: string;
  download: () => void;
};

/**
 * İndirilebilir şablonlar. İcra listelerinde iki tane var: çok sayfalı liste şablonu (bütün sayfalar
 * tek seferde aktarılır) ve önceki tek sayfalık şablon; birden fazlaysa kullanıcı seçer.
 */
export function templateOptions(spec: ImportSpec, ctx: ImportContext): TemplateOption[] {
  const out: TemplateOption[] = [];
  if (spec.kind === "enforcements" || spec.kind === "enforcementsOwed")
    out.push({
      id: "workbook",
      title: "Çok sayfalı liste şablonu",
      description:
        "Alacaklı olduğumuz, Borçlu olduğumuz ve şirket sayfaları tek dosyada. Bütün sayfalar tek seferde aktarılır; şirket sayfasının adını şirketin adı yapın.",
      download: () => downloadIcraWorkbookTemplate(ctx),
    });
  const file = spec.templateFile;
  if (file)
    out.push({
      id: "file",
      title: out.length ? "Önceki tek sayfalık şablon" : "Büronun şablonu",
      description: `${file.filename} · Tek sayfa; sütunları büronun Excel listesiyle aynı.`,
      download: () => downloadFile(file),
    });
  else if (!out.length)
    out.push({
      id: "generated",
      title: `${spec.title} şablonu`,
      description: "Açılır listeler ve her sütunun açıklaması bulunur.",
      download: () => downloadImportTemplate(spec, ctx),
    });
  return out;
}

const ICRA_SHEET_COLUMNS = [
  "status",
  "client",
  "debtors",
  "office",
  "no",
  "type",
  "procedure",
  "details",
  "principal",
  "openingDate",
  "note",
  "lastSeizureDate",
] as const;

/** Büronun Excel listesindeki başlıklar; sayfa türüne göre Alacaklı / Borçlu sütunları yer değiştirir */
function icraHeader(key: (typeof ICRA_SHEET_COLUMNS)[number], owed: boolean) {
  switch (key) {
    case "status":
      return "Dosya Durumu";
    case "client":
      return owed ? "Borçlu" : "Alacaklı";
    case "debtors":
      return owed ? "Alacaklı" : "Borçlu";
    case "office":
      return "Birim";
    case "no":
      return "Dosya No";
    case "type":
      return "Takip Türü";
    case "procedure":
      return "Takip Şekli";
    case "details":
      return "Takip Bilgileri";
    case "principal":
      return "Takip Çıkış Rakamı";
    case "openingDate":
      return "Dosya Açılış Tarihi";
    case "note":
      return "Açıklamalar";
    case "lastSeizureDate":
      return "Son Haciz Tarihi";
  }
}

/**
 * Çok sayfalı icra listesi şablonu: Alacaklı olduğumuz, Borçlu olduğumuz ve şirket sayfası.
 * Sayfa adlarına göre tanınır; şirket sayfasının adı şirketin adı (ör. ABC İnşaat, XYZ Lojistik) olur.
 */
export function downloadIcraWorkbookTemplate(ctx: ImportContext) {
  const spec = IMPORT_SPECS.enforcements;
  const byKey = new Map(spec.columns.map((c) => [c.key, c]));
  const listKeys = ICRA_SHEET_COLUMNS.filter(
    (k) => byKey.get(k)?.options && (byKey.get(k)?.options?.(ctx).length ?? 0) > 0,
  ).filter((k) => k === "status" || k === "type" || k === "procedure");
  const lists: ExcelSheet = {
    name: "Listeler",
    columns: listKeys.map((k) => ({ header: icraHeader(k, false), width: 34 })),
    rows: Array.from(
      { length: Math.max(0, ...listKeys.map((k) => byKey.get(k)!.options!(ctx).length)) },
      (_, i) => listKeys.map((k) => byKey.get(k)!.options!(ctx)[i] ?? null),
    ),
  };
  const sheet = (name: string, owed: boolean): ExcelSheet => ({
    name,
    columns: ICRA_SHEET_COLUMNS.map((k) => ({
      header: icraHeader(k, owed),
      width: byKey.get(k)?.width ?? 20,
      money: k === "principal",
    })),
    rows: [],
    validations: listKeys.map((k, i) => {
      const col = excelColumnName(i);
      return {
        col: ICRA_SHEET_COLUMNS.indexOf(k),
        source: `'Listeler'!$${col}$2:$${col}$${byKey.get(k)!.options!(ctx).length + 1}`,
      };
    }),
  });
  const help: ExcelSheet = {
    name: "Açıklama",
    columns: [
      { header: "Konu", width: 30 },
      { header: "Açıklama", width: 100 },
    ],
    rows: [
      [
        "Sayfalar",
        "Dosyadaki her sayfa tek seferde aktarılır. Sayfa adları aşağıdaki gibi tanınır.",
      ],
      ["Alacaklı olduğumuz dosyalar", "Müvekkilin alacaklı olduğu takipler. Adı değiştirmeyin."],
      [
        "Borçlu olduğumuz dosyalar",
        "Müvekkilin borçlu olduğu takipler (Borçlu sütunu müvekkildir). Adı değiştirmeyin.",
      ],
      [
        "Şirket sayfası",
        "Sayfa adını şirketin adı yapın (ör. ABC İnşaat, XYZ Lojistik). Şirketin alacaklı olduğu satırlar alacaklı listesine, Borçlu sütununda olduğu satırlar borçlu olduğumuz listesine yazılır. İstediğiniz kadar şirket sayfası ekleyebilirsiniz.",
      ],
      ["Maaş haczi sırası", "Aktarılmaz. İcra → Maaş haczi sıraları ekranından girilir."],
      [],
      ["Dosya No", "2026/101 E. biçimine getirilir; E. yazılmasa da olur."],
      [
        "Alacaklı / Borçlu",
        `Birden fazla kişi "1- Ad 2- Ad" biçiminde yazılabilir. Parantezdeki rol notları ("Diğer Haciz Alacaklısı: …") dosya notuna ayrılır.`,
      ],
      ["Dosya Durumu", "Açık, Açık (Durdurulmuş : Takibe İtiraz), Kapalı (İnfaz)… Boşsa Açık."],
      [
        "Son Haciz Tarihi",
        "Hücrede birden fazla tarih varsa en sonuncusu alınır, hücrenin tamamı nota eklenir.",
      ],
      ["Başlık satırı", "İlk satırdaki başlıkları değiştirmeyin; sütun sırası önemli değil."],
    ],
  };
  downloadWorkbook("İcra listesi şablonu", [
    sheet("Alacaklı olduğumuz dosyalar", false),
    sheet("Borçlu olduğumuz dosyalar", true),
    sheet("Şirket adı", false),
    lists,
    help,
  ]);
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
