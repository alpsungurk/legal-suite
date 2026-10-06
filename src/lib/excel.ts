/** Bağımlılıksız .xlsx üretimi (fflate ile zip). Birden fazla sayfa destekler. */
import { zipSync } from "fflate";
import { today } from "@/lib/format";

export type ExcelCell = string | number | null | undefined;
export type ExcelColumn = { header: string; money?: boolean; width?: number };
export type ExcelSheet = { name: string; columns: ExcelColumn[]; rows: ExcelCell[][] };

function safeFileName(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replaceAll(/[^a-z0-9çğıöşü]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function safeSheetName(value: string) {
  const cleaned = value
    .replaceAll(/[\\/?*:[\]]/g, " ")
    .split("")
    .filter((c) => c.charCodeAt(0) >= 32)
    .join("");
  return cleaned.trim().slice(0, 31) || "Kayıtlar";
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function colName(index: number) {
  let name = "";
  let v = index + 1;
  while (v > 0) {
    const r = (v - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    v = Math.floor((v - 1) / 26);
  }
  return name;
}

function sheetXml(sheet: ExcelSheet) {
  const { columns, rows } = sheet;
  const lastCol = colName(Math.max(columns.length - 1, 0));
  const lastRow = Math.max(rows.length + 1, 1);
  const widths = columns.map(
    (c, i) =>
      c.width ??
      Math.min(
        48,
        Math.max(
          12,
          rows.reduce((w, r) => Math.max(w, String(r[i] ?? "").length + 2), c.header.length + 3),
        ),
      ),
  );
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  const header = columns
    .map(
      (c, i) =>
        `<c r="${colName(i)}1" s="1" t="inlineStr"><is><t>${xmlEscape(c.header)}</t></is></c>`,
    )
    .join("");
  const data = rows
    .map((row, ri) => {
      const cells = columns
        .map((c, ci) => {
          const v = row[ci];
          const ref = `${colName(ci)}${ri + 2}`;
          if (typeof v === "number" && Number.isFinite(v)) {
            return `<c r="${ref}"${c.money ? ' s="2"' : ""}><v>${v}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v ?? ""))}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 2}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${cols}</cols>
<sheetData><row r="1" ht="26" customHeight="1">${header}</row>${data}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₺&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF143064"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function downloadWorkbook(fileTitle: string, sheets: ExcelSheet[]) {
  const enc = new TextEncoder();
  const names = sheets.map((s, i) => {
    const base = safeSheetName(s.name);
    return sheets.slice(0, i).some((o) => safeSheetName(o.name) === base)
      ? `${base.slice(0, 28)} ${i + 1}`
      : base;
  });
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc.encode(contentTypes),
    "_rels/.rels": enc.encode(rootRels),
    "xl/workbook.xml": enc.encode(workbook),
    "xl/_rels/workbook.xml.rels": enc.encode(wbRels),
    "xl/styles.xml": enc.encode(STYLES),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(s))));
  const zipped = zipSync(files);
  const blob = new Blob([zipped.slice().buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(fileTitle)}-${today()}.xlsx`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadExcel(title: string, columns: ExcelColumn[], rows: ExcelCell[][]) {
  downloadWorkbook(title, [{ name: title, columns, rows }]);
}
