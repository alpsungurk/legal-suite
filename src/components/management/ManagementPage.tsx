import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Download, Edit3, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { zipSync } from "fflate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ManagementEditorDialog,
  type ManagementFormField,
} from "@/components/management/ManagementEditorDialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ManagementColumn = {
  key: string;
  label: string;
  filterable?: boolean;
  filterOptions?: string[];
};

export type ManagementRow = Record<string, string> & { id: string };

type Props = {
  title: string;
  description: string;
  singular: string;
  icon: ElementType;
  rows: ManagementRow[];
  columns: ManagementColumn[];
  stats: Array<{ label: string; value: string; note: string }>;
  searchPlaceholder?: string;
  initialQuery?: string;
  accent?: "blue" | "green" | "amber" | "violet";
  formFields?: ManagementFormField[];
  allowRowExport?: boolean;
  rowExportLabel?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  readOnly?: boolean;
  externalFilters?: ReactNode;
  customRowActions?: Array<{
    label: string;
    icon?: ElementType;
    onClick: (row: ManagementRow) => void;
    className?: string;
    isVisible?: (row: ManagementRow) => boolean;
  }>;
  onSave?: (data: Record<string, string>, editingId: string | null) => void;
  onDelete?: (id: string) => void;
  onRowClick?: (row: ManagementRow) => void;
  onSearchChange?: (query: string) => void;
  emptyCreateValues?: Record<string, string>;
  getEditValues?: (row: ManagementRow) => Record<string, string>;
};

const tones = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const statusTones: Record<string, string> = {
  Aktif:
    "border-emerald-300/80 bg-emerald-100 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.08)] dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Pasif:
    "border-slate-300/80 bg-slate-100 text-slate-700 shadow-[0_0_0_1px_rgba(100,116,139,0.08)] dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  Tamamlandı:
    "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Hazır:
    "border-teal-300/80 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  Beklemede:
    "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  "Onay bekliyor":
    "border-orange-300/80 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  Duruşma:
    "border-sky-300/80 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  Karar:
    "border-indigo-300/80 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  Kapalı:
    "border-slate-300/80 bg-slate-200/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  "Ön inceleme":
    "border-violet-300/80 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Önemli:
    "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  Tahsilat:
    "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Güncellendi:
    "border-blue-300/80 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  Müvekkil:
    "border-fuchsia-300/80 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
  Dosya:
    "border-violet-300/80 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Güncel:
    "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Borçlu:
    "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  Alacaklı:
    "border-sky-300/80 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  Alındı:
    "border-emerald-300/80 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Belgelendi:
    "border-cyan-300/80 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  Güncellenmeli:
    "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Tebligat:
    "border-cyan-300/80 bg-cyan-100 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  "Delil toplama":
    "border-purple-300/80 bg-purple-100 text-purple-900 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  Toplantı:
    "border-sky-300/80 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  Masraf:
    "border-orange-300/80 bg-orange-100 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  Admin:
    "border-blue-400/70 bg-[#143064]/10 text-[#143064] dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200",
  Avukat:
    "border-violet-300/80 bg-violet-100 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  Sekreter:
    "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Okunmadı:
    "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Okundu:
    "border-emerald-300/80 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  Hatırlatma:
    "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Kullanıcı:
    "border-blue-300/80 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  Belgesiz:
    "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  İptal:
    "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  Dava: "border-indigo-300/80 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  İcra: "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  Danışmanlık:
    "border-teal-300/80 bg-teal-100 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  Arabuluculuk:
    "border-sky-300/80 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
};

function getStatusTone(value: string) {
  return (
    statusTones[value] ??
    "border-slate-300/80 bg-slate-100 text-slate-700 ring-1 ring-slate-200/60 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
  );
}

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
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("");
  return cleaned.trim().slice(0, 31) || "Kayıtlar";
}

function excelValue(value: string, key: string) {
  if (/amount|tutar|borc|odenen|kalan/i.test(key) && value.startsWith("₺")) {
    const normalized = value.replace(/[₺\s.]/g, "").replace(",", ".");
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric;
  }
  return value;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelColumnName(index: number) {
  let columnName = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    value = Math.floor((value - 1) / 26);
  }
  return columnName;
}

function downloadExcel(title: string, columns: ManagementColumn[], rows: ManagementRow[]) {
  const lastColumn = excelColumnName(columns.length - 1);
  const lastRow = Math.max(rows.length + 1, 1);
  const columnWidths = columns.map((column) => {
    const widestValue = rows.reduce(
      (width, row) => Math.max(width, (row[column.key] ?? "").length),
      column.label.length + 2,
    );
    return Math.min(42, Math.max(12, widestValue));
  });
  const columnXml = columnWidths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const headerCells = columns
    .map(
      (column, index) =>
        `<c r="${excelColumnName(index)}1" s="1" t="inlineStr"><is><t>${xmlEscape(column.label)}</t></is></c>`,
    )
    .join("");
  const dataRows = rows
    .map((row, rowIndex) => {
      const cells = columns
        .map((column, columnIndex) => {
          const value = excelValue(row[column.key] ?? "", column.key);
          const cellRef = `${excelColumnName(columnIndex)}${rowIndex + 2}`;
          if (typeof value === "number") {
            const style = /amount|tutar|borc|odenen|kalan/i.test(column.key) ? ' s="2"' : "";
            return `<c r="${cellRef}"${style}><v>${value}</v></c>`;
          }
          return `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join("");
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${columnXml}</cols>
<sheetData><row r="1" ht="26" customHeight="1">${headerCells}</row>${dataRows}</sheetData>
<autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₺&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF143064"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEscape(safeSheetName(title))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const files = zipSync({
    "[Content_Types].xml": new TextEncoder().encode(contentTypesXml),
    "_rels/.rels": new TextEncoder().encode(rootRelsXml),
    "xl/workbook.xml": new TextEncoder().encode(workbookXml),
    "xl/_rels/workbook.xml.rels": new TextEncoder().encode(workbookRelsXml),
    "xl/worksheets/sheet1.xml": new TextEncoder().encode(sheetXml),
    "xl/styles.xml": new TextEncoder().encode(stylesXml),
  });
  const blob = new Blob([files.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(title)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadRecord(title: string, row: ManagementRow, columns: ManagementColumn[]) {
  downloadExcel(`${title} - ${row[columns[0]?.key] ?? "Kayıt"}`, columns, [row]);
}

function dateOnly(value: string) {
  const isoDate = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const localizedDate = value.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!localizedDate) return "";
  const [, day, month, year] = localizedDate;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

const defaultFields: ManagementFormField[] = [
  { name: "title", label: "Başlık / ad", placeholder: "Bilgi girin", required: true },
  {
    name: "subtitle",
    label: "Açıklama",
    type: "textarea",
    placeholder: "Kısa açıklama girin",
    required: true,
    fullWidth: true,
  },
  {
    name: "status",
    label: "Durum",
    type: "select",
    options: ["Aktif", "Beklemede", "Tamamlandı"],
    required: true,
  },
];

export function ManagementPage({
  title,
  description,
  singular,
  icon: Icon,
  rows,
  columns,
  stats,
  searchPlaceholder,
  initialQuery = "",
  accent = "blue",
  formFields = defaultFields,
  allowRowExport = false,
  rowExportLabel = "Dışa aktar",
  canCreate = true,
  canEdit = true,
  canDelete = true,
  readOnly = false,
  externalFilters,
  customRowActions = [],
  onSave,
  onDelete,
  onRowClick,
  onSearchChange,
  emptyCreateValues = {},
  getEditValues,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [dateColumn, setDateColumn] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRow, setSelectedRow] = useState<ManagementRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ManagementRow | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filterableColumns = columns.filter((c) => c.filterable);
  const dateColumns = columns.filter((column) =>
    /(date|tarih|timestamp|createdAt|updatedAt|zaman|due)/i.test(column.key),
  );
  const activeDateColumn =
    dateColumns.find((column) => column.key === dateColumn) ?? dateColumns[0];

  const visibleRows = useMemo(() => {
    const q = query.toLocaleLowerCase("tr");
    return rows.filter((row) => {
      const textMatch =
        !q || columns.some((col) => (row[col.key] ?? "").toLocaleLowerCase("tr").includes(q));
      if (!textMatch) return false;
      return (
        filterableColumns.every((col) => {
          const filter = columnFilters[col.key];
          if (!filter || filter === "Tümü") return true;
          return (row[col.key] ?? "") === filter;
        }) &&
        (() => {
          if (!activeDateColumn || (!dateFrom && !dateTo)) return true;
          const date = dateOnly(row[activeDateColumn.key] ?? "");
          if (!date) return false;
          return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
        })()
      );
    });
  }, [rows, query, columns, columnFilters, filterableColumns, activeDateColumn, dateFrom, dateTo]);

  const openCreate = () => {
    setEditingId(null);
    setEditorValues(emptyCreateValues);
    setEditorOpen(true);
  };

  const openEdit = (row: ManagementRow) => {
    setEditingId(row.id);
    setEditorValues(getEditValues ? getEditValues(row) : { ...row });
    setEditorOpen(true);
  };

  const save = (data: Record<string, string>) => {
    if (onSave) onSave(data, editingId);
    else toast.success(editingId ? `${singular} güncellendi` : `Yeni ${singular} eklendi`);
    setEditorOpen(false);
    setEditingId(null);
  };

  const badgeKeys = new Set(["status", "role", "type", "readStatus"]);
  const showActions =
    !readOnly && (canEdit || canDelete || allowRowExport || customRowActions.length > 0);

  return (
    <div className="mx-auto min-w-0 max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <span
              className={`grid h-7 w-7 place-items-center rounded-lg transition-transform duration-300 hover:scale-105 ${tones[accent]}`}
            >
              <Icon className="h-4 w-4" />
            </span>{" "}
            Operasyon merkezi
          </div>
          <h2 className="text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 transition-all duration-200 hover:-translate-y-0.5 sm:flex-none"
            onClick={() => {
              downloadExcel(title, columns, visibleRows);
              toast.success("Excel dosyası indirildi");
            }}
          >
            <Download /> <span className="hidden sm:inline">Dışa aktar</span>
          </Button>
          {!readOnly && canCreate && (
            <Button
              className="flex-1 transition-all duration-200 hover:-translate-y-0.5 sm:flex-none"
              onClick={openCreate}
            >
              <Plus /> Yeni {singular}
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className="stat-enter relative overflow-hidden border-border/80 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <CardContent className="p-4">
              <span
                className={`absolute right-0 top-0 h-14 w-14 -translate-y-5 translate-x-5 rounded-full transition-transform duration-500 group-hover:scale-110 ${tones[accent]}`}
              />
              <p className="relative text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="relative mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="relative mt-1 text-xs font-medium text-success">{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-border/80 bg-card/95 shadow-elevated animate-in fade-in-0 duration-500">
        <div className="flex flex-col gap-3 border-b bg-gradient-to-b from-card to-muted/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  onSearchChange?.(event.target.value);
                }}
                placeholder={searchPlaceholder ?? `${title} içinde ara...`}
                className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-9 text-sm shadow-xs outline-none transition-[color,box-shadow,transform] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            {externalFilters}
          </div>
          {filterableColumns.length > 0 && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in-0 slide-in-from-top-1 duration-300 sm:grid-cols-2 lg:grid-cols-4">
              {filterableColumns.map((col) => {
                const options =
                  col.filterOptions ??
                  Array.from(new Set(rows.map((r) => r[col.key]).filter(Boolean))).sort((a, b) =>
                    a.localeCompare(b, "tr"),
                  );
                return (
                  <div key={col.key} className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">{col.label}</p>
                    <Select
                      value={columnFilters[col.key] ?? "Tümü"}
                      onValueChange={(value) =>
                        setColumnFilters((prev) => ({ ...prev, [col.key]: value }))
                      }
                    >
                      <SelectTrigger className="h-9 w-full bg-background transition-shadow hover:shadow-soft">
                        <SelectValue placeholder={col.label} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tümü">Tümü</SelectItem>
                        {options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
          {dateColumns.length > 0 && (
            <div className="grid grid-cols-1 gap-2 rounded-xl border bg-background/70 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_1fr_1fr_auto]">
              {dateColumns.length > 1 && (
                <Select value={activeDateColumn?.key} onValueChange={setDateColumn}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Tarih alanı" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateColumns.map((column) => (
                      <SelectItem key={column.key} value={column.key}>
                        {column.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                type="date"
                aria-label="Başlangıç tarihi"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-9"
              />
              <Input
                type="date"
                aria-label="Bitiş tarihi"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-9"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-9"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Tarih filtresini temizle
              </Button>
            </div>
          )}
        </div>

        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="sticky top-0 z-10 border-b bg-muted/80 hover:bg-muted/80 backdrop-blur-sm">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {col.label}
                </TableHead>
              ))}
              {showActions && <TableHead className="w-12 px-4 py-3" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                className="row-enter cursor-pointer border-b border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/[0.015] hover:shadow-soft"
                style={{ animationDelay: `${Math.min(rowIndex, 18) * 28}ms` }}
                tabIndex={0}
                onClick={() => {
                  setSelectedRow(row);
                  onRowClick?.(row);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRow(row);
                    onRowClick?.(row);
                  }
                }}
              >
                {columns.map((col) => {
                  const value = row[col.key] ?? "";
                  const isBadge = badgeKeys.has(col.key);
                  return (
                    <TableCell key={col.key} className="px-4 py-4 align-middle">
                      {isBadge && value ? (
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-transform duration-200 hover:scale-[1.04] ${getStatusTone(value)}`}
                        >
                          {value}
                        </Badge>
                      ) : (
                        <span className="text-sm font-medium text-foreground/90">{value}</span>
                      )}
                    </TableCell>
                  );
                })}
                {showActions && (
                  <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                    {(customRowActions.some((action) => action.isVisible?.(row) ?? true) ||
                      canEdit ||
                      canDelete ||
                      allowRowExport) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg border border-border/80 bg-background/80 transition-all duration-200 hover:scale-105 hover:shadow-soft"
                            aria-label={`${row[columns[0]?.key] ?? singular} işlemleri`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {customRowActions
                            .filter((action) => action.isVisible?.(row) ?? true)
                            .map((action) => {
                              const Icon = action.icon;
                              return (
                                <DropdownMenuItem
                                  key={action.label}
                                  className={action.className}
                                  onClick={() => action.onClick(row)}
                                >
                                  {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                                  {action.label}
                                </DropdownMenuItem>
                              );
                            })}
                          {customRowActions.some((action) => action.isVisible?.(row) ?? true) ? (
                            <DropdownMenuSeparator />
                          ) : null}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              <Edit3 /> Düzenle
                            </DropdownMenuItem>
                          )}
                          {allowRowExport && (
                            <DropdownMenuItem
                              onClick={() => {
                                downloadRecord(title, row, columns);
                                toast.success("Kayıt dışa aktarıldı");
                              }}
                            >
                              <Download /> {rowExportLabel}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 /> Sil
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!visibleRows.length && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="h-28 text-center text-muted-foreground"
                >
                  Sonuç bulunamadı. Arama veya filtreleri değiştirin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRow?.[columns[0]?.key] ?? `${singular} detayı`}</DialogTitle>
            <DialogDescription>{title} · kayıt detayları</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(selectedRow ?? {})
              .filter(([key]) => key !== "id")
              .map(([key, value]) => {
                const column = columns.find((item) => item.key === key);
                const label =
                  column?.label ??
                  key
                    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
                    .replace(/^./, (letter) => letter.toLocaleUpperCase("tr"));
                return (
                  <div key={key} className="rounded-xl border bg-muted/20 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line break-words text-sm font-medium text-foreground">
                      {value || "—"}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <ManagementEditorDialog
          open={editorOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditorOpen(false);
              setEditingId(null);
            }
          }}
          title={editingId ? `${singular} düzenle` : `Yeni ${singular}`}
          description="Bilgileri kaydettikten sonra liste anında güncellenir."
          fields={formFields}
          values={editorValues}
          formId="entity"
          onSave={save}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydı silmek istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.[columns[0]?.key] ?? "Kayıt"}</strong> silinecek. Bu işlem geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget && onDelete) onDelete(deleteTarget.id);
                else toast.success(`${singular} silindi`);
                setDeleteTarget(null);
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
