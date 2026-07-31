import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { Download, Edit3, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
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
  Stajyer:
    "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
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
  Dava:
    "border-indigo-300/80 bg-indigo-100 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  İcra:
    "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
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

function downloadCsv(title: string, columns: ManagementColumn[], rows: ManagementRow[]) {
  const content = [
    columns.map((c) => c.label).join(";"),
    ...rows.map((r) =>
      columns.map((c) => `"${(r[c.key] ?? "").replaceAll('"', '""')}"`).join(";"),
    ),
  ].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(
    new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
  );
  anchor.download = `${title.toLocaleLowerCase("tr").replaceAll(" ", "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function downloadRecord(title: string, row: ManagementRow, columns: ManagementColumn[]) {
  const body = columns
    .map((c) => `<p><strong>${c.label}:</strong> ${row[c.key] ?? ""}</p>`)
    .join("");
  const documentContent = `<!doctype html><html><head><meta charset="utf-8"><title>${row[columns[0]?.key] ?? "Kayıt"}</title></head><body><h1>${title}</h1>${body}</body></html>`;
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([documentContent], { type: "application/msword" }));
  anchor.download = `${(row[columns[0]?.key] ?? "kayit").replaceAll(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/g, "-").replaceAll(/^-|-$/g, "")}.doc`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
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
  onSave,
  onDelete,
  onRowClick,
  onSearchChange,
  emptyCreateValues = {},
  getEditValues,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ManagementRow | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filterableColumns = columns.filter((c) => c.filterable);

  const visibleRows = useMemo(() => {
    const q = query.toLocaleLowerCase("tr");
    return rows.filter((row) => {
      const textMatch =
        !q || columns.some((col) => (row[col.key] ?? "").toLocaleLowerCase("tr").includes(q));
      if (!textMatch) return false;
      return filterableColumns.every((col) => {
        const filter = columnFilters[col.key];
        if (!filter || filter === "Tümü") return true;
        return (row[col.key] ?? "") === filter;
      });
    });
  }, [rows, query, columns, columnFilters, filterableColumns]);

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

  const badgeKeys = new Set(["status", "stage", "role", "type", "readStatus"]);

  return (
    <div className="page-enter mx-auto min-w-0 max-w-[1500px] space-y-6">
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
              downloadCsv(title, columns, visibleRows);
              toast.success("CSV dosyası indirildi");
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

      <Card className="overflow-hidden border-border/80 shadow-card animate-in fade-in-0 duration-500">
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
        </div>

        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 z-10 border-b bg-muted/70 hover:bg-muted/70 backdrop-blur-sm">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="whitespace-nowrap px-3 font-semibold text-foreground/80"
                >
                  {col.label}
                </TableHead>
              ))}
              {!readOnly && <TableHead className="w-12 px-3" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, rowIndex) => (
              <TableRow
                key={row.id}
                className={`row-enter ${onRowClick ? "cursor-pointer" : ""}`}
                style={{ animationDelay: `${Math.min(rowIndex, 18) * 28}ms` }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => {
                  const value = row[col.key] ?? "";
                  const isBadge = badgeKeys.has(col.key);
                  return (
                    <TableCell key={col.key} className="px-3 py-3">
                      {isBadge && value ? (
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-transform duration-200 hover:scale-[1.04] ${getStatusTone(value)}`}
                        >
                          {value}
                        </Badge>
                      ) : (
                        <span className="text-sm">{value}</span>
                      )}
                    </TableCell>
                  );
                })}
                {!readOnly && (
                  <TableCell className="px-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 transition-transform hover:scale-105"
                          aria-label={`${row[columns[0]?.key] ?? singular} işlemleri`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!visibleRows.length && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (readOnly ? 0 : 1)}
                  className="h-28 text-center text-muted-foreground"
                >
                  Sonuç bulunamadı. Arama veya filtreleri değiştirin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
              <strong>{deleteTarget?.[columns[0]?.key] ?? "Kayıt"}</strong> silinecek. Bu işlem
              geri alınamaz.
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
