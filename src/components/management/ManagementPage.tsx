import { useMemo, useState, type ElementType } from "react";
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
  ManagementEditorDialog,
  type ManagementFormField,
} from "@/components/management/ManagementEditorDialog";

export type ManagementRow = {
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  amount?: string;
};
type Props = {
  title: string;
  description: string;
  singular: string;
  icon: ElementType;
  rows: ManagementRow[];
  stats: Array<{ label: string; value: string; note: string }>;
  searchPlaceholder?: string;
  accent?: "blue" | "green" | "amber" | "violet";
  formFields?: ManagementFormField[];
  filterOptions?: string[];
  allowRowExport?: boolean;
  rowExportLabel?: string;
};
const tones = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};
const statusTones: Record<string, string> = {
  Aktif:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Tamamlandı:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Hazır:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Beklemede:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  "Onay bekliyor":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Duruşma:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  "Ön inceleme":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  İncelemede:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  Önemli:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  Tahsilat:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Evrak:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  Güncellendi:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  Müvekkil:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  Dosya:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  Güncel:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  Belgelendi:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  Güncellenmeli:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Tebligat:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  "Delil toplama":
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  Toplantı:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  Masraf:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
};
function downloadCsv(title: string, rows: ManagementRow[]) {
  const content = [
    "Başlık;Açıklama;Bilgi;Durum;Tutar",
    ...rows.map((r) =>
      [r.title, r.subtitle, r.meta, r.status, r.amount ?? ""]
        .map((v) => `"${v.replaceAll('"', '""')}"`)
        .join(";"),
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
function downloadRecord(title: string, row: ManagementRow) {
  const documentContent = `<!doctype html><html><head><meta charset="utf-8"><title>${row.title}</title></head><body><h1>${row.title}</h1><p><strong>${title}</strong></p><p>${row.subtitle}</p><p>${row.meta}</p><p>Durum: ${row.status}</p></body></html>`;
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([documentContent], { type: "application/msword" }));
  anchor.download = `${row.title.replaceAll(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+/g, "-").replaceAll(/^-|-$/g, "")}.doc`;
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
    name: "meta",
    label: "Ek bilgi",
    placeholder: "İlgili detayları girin",
    type: "textarea",
    required: true,
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
  rows: initialRows,
  stats,
  searchPlaceholder,
  accent = "blue",
  formFields = defaultFields,
  filterOptions,
  allowRowExport = false,
  rowExportLabel = "Dışa aktar",
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<ManagementRow | null>(null);
  const [activeFilter, setActiveFilter] = useState("Tümü");
  const [deleteTarget, setDeleteTarget] = useState<ManagementRow | null>(null);
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          `${row.title} ${row.subtitle} ${row.meta}`
            .toLocaleLowerCase("tr")
            .includes(query.toLocaleLowerCase("tr")) &&
          (activeFilter === "Tümü" || row.status === activeFilter),
      ),
    [activeFilter, query, rows],
  );
  const availableFilters = filterOptions ?? [
    "Tümü",
    ...Array.from(new Set(rows.map((row) => row.status))),
  ];
  const isEditing = editor && rows.some((row) => row === editor);
  const save = (data: Record<string, string>) => {
    const next = {
      title: data.title,
      subtitle: data.subtitle,
      meta: data.meta,
      status: data.status || "Aktif",
      amount: data.amount || undefined,
    };
    if (isEditing)
      setRows((current) => current.map((row) => (row === editor ? { ...row, ...next } : row)));
    else setRows((current) => [{ ...next }, ...current]);
    setEditor(null);
    toast.success(isEditing ? `${singular} güncellendi` : `Yeni ${singular} eklendi`);
  };
  return (
    <div className="mx-auto min-w-0 max-w-[1500px] space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <section className="flex flex-col gap-4 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <span className={`grid h-7 w-7 place-items-center rounded-lg ${tones[accent]}`}>
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
            className="flex-1 sm:flex-none"
            onClick={() => {
              downloadCsv(title, rows);
              toast.success("CSV dosyası indirildi");
            }}
          >
            <Download /> <span className="hidden sm:inline">Dışa aktar</span>
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => setEditor({ title: "", subtitle: "", meta: "", status: "Aktif" })}
          >
            <Plus /> Yeni {singular}
          </Button>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="relative overflow-hidden border-border/80 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card"
          >
            <CardContent className="p-4">
              <span
                className={`absolute right-0 top-0 h-14 w-14 -translate-y-5 translate-x-5 rounded-full ${tones[accent]}`}
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
      <Card className="overflow-hidden border-border/80 shadow-card">
        <div className="flex flex-col gap-3 border-b bg-card p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder ?? `${title} içinde ara...`}
              className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-9 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="h-10 w-full bg-background md:w-48">
              <SelectValue placeholder="Duruma göre filtrele" />
            </SelectTrigger>
            <SelectContent>
              {availableFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="divide-y divide-border/70">
          {visibleRows.map((row, index) => (
            <div
              key={`${row.title}-${index}`}
              className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 p-4 transition-all duration-200 hover:bg-primary/[0.035] sm:px-5 sm:py-4 lg:grid-cols-[auto_minmax(220px,1.25fr)_minmax(260px,0.9fr)_minmax(92px,auto)_auto_auto] lg:gap-x-5"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${tones[accent]}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">{row.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{row.subtitle}</p>
              </div>
              <p className="col-start-2 break-words text-sm text-muted-foreground lg:col-auto">
                {row.meta}
              </p>
              <p className="hidden text-right text-sm font-semibold tabular-nums lg:block">
                {row.amount}
              </p>
              <Badge
                variant="outline"
                className={`col-start-2 row-start-3 mt-2 w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold lg:col-auto lg:row-auto lg:mt-0 lg:min-w-[118px] lg:justify-center lg:justify-self-end ${statusTones[row.status] ?? "border-slate-200 bg-slate-50 text-slate-700"}`}
              >
                {row.status}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-start-3 row-start-1 h-9 w-9 shrink-0 lg:col-auto lg:row-auto"
                    aria-label={`${row.title} işlemleri`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditor(row)}>
                    <Edit3 /> Düzenle
                  </DropdownMenuItem>
                  {allowRowExport && (
                    <DropdownMenuItem
                      onClick={() => {
                        downloadRecord(title, row);
                        toast.success(`${row.title} dışa aktarıldı`);
                      }}
                    >
                      <Download /> {rowExportLabel}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <Trash2 /> Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {!visibleRows.length && (
            <div className="p-12 text-center">
              <p className="font-medium">Sonuç bulunamadı</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Arama ifadenizi veya filtreleri değiştirin.
              </p>
            </div>
          )}
        </div>
      </Card>
      <ManagementEditorDialog
        open={!!editor}
        onOpenChange={(open) => !open && setEditor(null)}
        title={isEditing ? `${singular} düzenle` : `Yeni ${singular}`}
        description="Bilgileri kaydettikten sonra liste anında güncellenir."
        fields={formFields}
        values={editor ?? undefined}
        formId="entity"
        onSave={save}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaydı silmek istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.title}</strong> kaydı silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setRows((current) => current.filter((row) => row !== deleteTarget));
                setDeleteTarget(null);
                toast.success(`${singular} silindi`);
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
