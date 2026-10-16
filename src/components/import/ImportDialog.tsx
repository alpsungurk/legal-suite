/**
 * Excel ile toplu aktarım: şablonu indir → doldur → yükle → satırları kontrol et / düzelt → onayla.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  UserRound,
  Wand2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, MultiCombobox, Segmented, type Option } from "@/components/app/fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useErp } from "@/lib/erp-store";
import { readSpreadsheet } from "@/lib/excel-read";
import { downloadWorkbook } from "@/lib/excel";
import {
  cellToText,
  headerKey,
  IMPORT_ORDER,
  IMPORT_SPECS,
  type ImportContext,
  type ImportKind,
  type ImportSpec,
  type RowCheck,
  type RowValues,
} from "@/lib/import-specs";
import { downloadTemplate, ERROR_COLUMN, REQUIRED_MARK } from "@/lib/import-template";
import { cn } from "@/lib/utils";
import { OverlayLoader } from "@/components/app/Loader";

const PAGE_SIZE = 50;
const MAX_ROWS = 5000;

type Row = { id: number; line: number; values: RowValues };
type Status = "ok" | "error" | "existing";
type Checked = Row & { check: RowCheck; status: Status; problems: string[] };

type FileInfo = {
  name: string;
  sheet: string;
  unknown: string[];
  missing: string[];
  truncated: boolean;
};

/* ───────────── Dosyayı satırlara çevirme ───────────── */

async function ingest(file: File, spec: ImportSpec) {
  const wb = await readSpreadsheet(file);
  const keyOf = new Map<string, string>();
  for (const c of spec.columns)
    for (const h of [c.header, ...(c.aliases ?? [])]) keyOf.set(headerKey(h), c.key);

  // Başlık satırını ilk 10 satırda, en çok sütunun eşleştiği sayfada ara
  let best = { score: 0, sheet: wb.sheets[0], headerRow: 0 };
  for (const sheet of wb.sheets) {
    sheet.rows.slice(0, 10).forEach((row, i) => {
      const score = new Set(row.map((c) => keyOf.get(headerKey(String(c ?? "")))).filter(Boolean))
        .size;
      if (score > best.score) best = { score, sheet, headerRow: i };
    });
  }
  if (!best.score)
    throw new Error(
      `Dosyada ${spec.title.toLocaleLowerCase("tr")} şablonunun sütunları bulunamadı. Şablonu indirip onu doldurun.`,
    );

  const header = best.sheet.rows[best.headerRow] ?? [];
  const mapping: Array<{ index: number; key: string }> = [];
  const unknown: string[] = [];
  const used = new Set<string>();
  header.forEach((cell, index) => {
    const text = String(cell ?? "").trim();
    if (!text) return;
    const key = keyOf.get(headerKey(text));
    if (key && !used.has(key)) {
      mapping.push({ index, key });
      used.add(key);
    } else if (!key && headerKey(text) !== headerKey(ERROR_COLUMN)) unknown.push(text);
  });
  const missing = spec.columns.filter((c) => c.required && !used.has(c.key)).map((c) => c.header);
  const typeOf = new Map(spec.columns.map((c) => [c.key, c.type]));
  const multiOf = new Set(spec.columns.filter((c) => c.multiline).map((c) => c.key));

  const rows: Row[] = [];
  const data = best.sheet.rows.slice(best.headerRow + 1);
  for (let i = 0; i < data.length && rows.length < MAX_ROWS; i++) {
    const raw = data[i] ?? [];
    const values: RowValues = {};
    for (const { index, key } of mapping)
      values[key] = cellToText(raw[index] ?? null, typeOf.get(key), wb.date1904, multiOf.has(key));
    if (Object.values(values).every((v) => !v)) continue;
    rows.push({ id: i, line: best.headerRow + i + 2, values });
  }
  const remaining = data
    .slice(rows.length ? rows[rows.length - 1].id + 1 : 0)
    .some((r) => r?.some((c) => c != null && c !== ""));
  const info: FileInfo = {
    name: file.name,
    sheet: best.sheet.name,
    unknown,
    missing,
    truncated: rows.length >= MAX_ROWS && remaining,
  };
  return { rows, info };
}

/* ───────────── Toplu uygula (Excel'de "aşağı doldur" gibi) ───────────── */

/** Çok değerli sütunlar (sorumlu avukat) hücrede "Ad; Ad" metni olarak durur */
const splitMulti = (v: string) =>
  v
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

function BulkApply({
  spec,
  options,
  multiOptions,
  count,
  userName,
  onApply,
}: {
  spec: ImportSpec;
  options: Map<string, Option[]>;
  multiOptions: Map<string, Option[]>;
  count: number;
  userName: string;
  onApply: (key: string, value: string, onlyEmpty: boolean) => void;
}) {
  const columns = spec.columns.filter((c) => c.key !== "no");
  const [key, setKey] = useState(
    columns.find((c) => c.key === "responsible")?.key ?? columns[0]?.key ?? "",
  );
  const [value, setValue] = useState("");
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const col = columns.find((c) => c.key === key);
  if (!col) return null;
  const single = options.get(key);
  const multi = multiOptions.get(key);
  const apply = (v: string) => {
    onApply(key, v, onlyEmpty);
    toast.success(
      `${col.header}: ${v ? `"${v}"` : "boş"} ${count} satıra uygulandı${onlyEmpty ? " (yalnızca boş olanlara)" : ""}`,
    );
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2">
      <span className="flex items-center gap-1.5 self-center text-xs font-semibold text-muted-foreground">
        <Wand2 className="h-3.5 w-3.5" /> Toplu uygula
      </span>
      <div className="w-44">
        <Select
          value={key}
          onValueChange={(k) => {
            setKey(k);
            setValue("");
          }}
        >
          <SelectTrigger className="h-9" aria-label="Sütun">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.header}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-64">
        {multi ? (
          <MultiCombobox
            value={splitMulti(value)}
            onChange={(v) => setValue(v.join("; "))}
            options={multi}
            placeholder="Seçin"
          />
        ) : single ? (
          <Combobox
            value={value || undefined}
            onChange={setValue}
            options={single}
            placeholder="Seçin"
            creatable={col.creatable}
            allowClear
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={col.type === "date" ? "GG.AA.YYYY" : "Değer"}
            className="h-9"
          />
        )}
      </div>
      {col.key === "responsible" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setValue(userName)}
          title="Sorumlu olarak sizi seçer"
        >
          <UserRound /> Kendim
        </Button>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 self-center text-xs font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--primary)]"
          checked={onlyEmpty}
          onChange={(e) => setOnlyEmpty(e.target.checked)}
        />
        Yalnızca boş olanlar
      </label>
      <Button type="button" size="sm" className="ml-auto h-9" onClick={() => apply(value)}>
        {value ? "Uygula" : "Temizle"} · {count} satır
      </Button>
    </div>
  );
}

/* ───────────── Bileşen ───────────── */

export function ImportDialog({
  open,
  onOpenChange,
  kind: fixedKind,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind?: ImportKind;
}) {
  const { state, currentUser, permissions, importRecords, rememberOption } = useErp();
  const allowedKinds = IMPORT_ORDER.filter((k) => IMPORT_SPECS[k].allowed(permissions));
  const [kind, setKind] = useState<ImportKind | undefined>(fixedKind);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "error" | "ok">("all");
  const [page, setPage] = useState(0);
  const [includeExisting, setIncludeExisting] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setKind(fixedKind);
      setRows(null);
      setInfo(null);
      setFilter("all");
      setPage(0);
      setIncludeExisting(false);
    }
  }, [open, fixedKind]);

  const spec = kind ? IMPORT_SPECS[kind] : undefined;
  const ctx: ImportContext = useMemo(
    () => ({ state, user: currentUser, permissions }),
    [state, currentUser, permissions],
  );

  // Satır doğrulaması: düzenlenmeyen satırlar önbellekten gelir
  const cache = useMemo(() => new WeakMap<RowValues, RowCheck>(), [ctx, spec]);

  const checked: Checked[] = useMemo(() => {
    if (!spec || !rows) return [];
    const seen = new Map<string, number>();
    return rows.map((r) => {
      let check = cache.get(r.values);
      if (!check) {
        check = spec.check(r.values, ctx);
        cache.set(r.values, check);
      }
      const problems = [...check.warnings];
      let fileDup = false;
      if (check.key) {
        const first = seen.get(check.key);
        if (first != null) {
          fileDup = true;
          problems.unshift(`Dosyada tekrar ediyor (satır ${first})`);
        } else seen.set(check.key, r.line);
      }
      const hasErrors = Object.keys(check.errors).length > 0;
      const hardDup = !spec.softDuplicates && (!!check.existing || fileDup);
      if (check.existing) problems.unshift(check.existing);
      const status: Status =
        hasErrors || hardDup ? "error" : check.existing && !includeExisting ? "existing" : "ok";
      return { ...r, check, status, problems };
    });
  }, [rows, spec, ctx, cache, includeExisting]);

  const counts = useMemo(
    () => ({
      ok: checked.filter((r) => r.status === "ok").length,
      error: checked.filter((r) => r.status === "error").length,
      existing: checked.filter((r) => r.check.existing && !Object.keys(r.check.errors).length)
        .length,
    }),
    [checked],
  );

  const visible = checked.filter((r) =>
    filter === "all" ? true : filter === "error" ? r.status === "error" : r.status === "ok",
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const options = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const c of spec?.columns ?? [])
      if (c.options && (c.type === "enum" || c.type === "lookup"))
        map.set(
          c.key,
          c.options(ctx).map((o) => ({ value: o, label: o })),
        );
    return map;
  }, [spec, ctx]);

  // Çok değerli ve listeli sütunlar (sorumlu avukat): hücrede birden fazla seçim yapılabilir
  const multiOptions = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const c of spec?.columns ?? [])
      if (c.options && c.type === "multi")
        map.set(
          c.key,
          c.options(ctx).map((o) => ({ value: o, label: o })),
        );
    return map;
  }, [spec, ctx]);

  /** Görünen (filtreye uyan) bütün satırlara aynı değeri yazar */
  const applyToVisible = (key: string, value: string, onlyEmpty: boolean) => {
    const ids = new Set(visible.map((r) => r.id));
    setRows((rs) =>
      rs
        ? rs.map((r) =>
            ids.has(r.id) && (!onlyEmpty || !(r.values[key] ?? "").trim())
              ? { ...r, values: { ...r.values, [key]: value } }
              : r,
          )
        : rs,
    );
  };

  const loadFile = async (file: File) => {
    if (!spec) return;
    setBusy(true);
    try {
      const res = await ingest(file, spec);
      if (!res.rows.length) {
        toast.error("Dosyada aktarılacak satır bulunamadı.");
        return;
      }
      setRows(res.rows);
      setInfo(res.info);
      setFilter("all");
      setPage(0);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (id: number, key: string, value: string) =>
    setRows((rs) =>
      rs ? rs.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r)) : rs,
    );

  const removeRow = (id: number) => setRows((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));

  const downloadErrors = () => {
    if (!spec) return;
    const bad = checked.filter((r) => r.status === "error");
    downloadWorkbook(`${spec.title} hatalı satırlar`, [
      {
        name: "Veri",
        columns: [
          ...spec.columns.map((c) => ({
            header: c.required ? c.header + REQUIRED_MARK : c.header,
          })),
          { header: ERROR_COLUMN, width: 60 },
        ],
        rows: bad.map((r) => [
          ...spec.columns.map((c) => r.values[c.key] ?? ""),
          [
            ...Object.entries(r.check.errors).map(
              ([k, msg]) => `${spec.columns.find((c) => c.key === k)?.header ?? ""}: ${msg}`,
            ),
            ...r.problems,
          ].join(" · "),
        ]),
      },
    ]);
  };

  const commit = () => {
    if (!spec || busy) return;
    const ready = checked.filter((r) => r.status === "ok").map((r) => r.values);
    if (!ready.length) return;
    setBusy(true);
    try {
      const batch = spec.build(ready, ctx);
      importRecords(batch, `${ready.length} ${spec.noun} · ${info?.name ?? "Excel"}`);
      // Yeni mahkeme / icra daireleri seçim listelerine eklenir
      for (const c of batch.cases ?? []) rememberOption("courts", c.court);
      for (const e of batch.enforcements ?? []) {
        rememberOption("enforcementOffices", e.office);
        rememberOption("enforcementTypes", e.type);
        if (e.stopReason) rememberOption("enforcementStopReasons", e.stopReason);
        if (e.closeReason) rememberOption("enforcementCloseReasons", e.closeReason);
      }
      const icra = kind === "enforcements" || kind === "enforcementsOwed";
      const extraParties = icra ? (batch.debtors?.length ?? 0) : 0;
      const extraClients = icra ? (batch.clients?.length ?? 0) : 0;
      toast.success(
        [
          `${ready.length} ${spec.noun} aktarıldı`,
          extraClients ? `${extraClients} yeni müvekkil` : "",
          extraParties ? `${extraParties} yeni karşı taraf kartı` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
      if (counts.error) toast.warning(`${counts.error} hatalı satır aktarılmadı`);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Aktarım yapılamadı: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const title = spec ? `Excel ile toplu aktar · ${spec.title}` : "Excel ile toplu aktar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(92svh,920px)] w-[min(96vw,1600px)] max-w-[min(96vw,1600px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,1600px)]",
        )}
      >
        {busy && rows ? <OverlayLoader label="Aktarılıyor…" /> : null}
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5 text-left">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>
            {rows
              ? `${info?.name} · ${info?.sheet} sayfası · ${rows.length} satır okundu. Hücreleri buradan düzeltebilirsiniz.`
              : "Şablonu indirin, doldurun ve yükleyin. Kaydetmeden önce her satırı kontrol edip düzeltebilirsiniz."}
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {!fixedKind && (
              <div>
                <p className="mb-2 text-[14px] font-medium">Ne aktarmak istiyorsunuz?</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {allowedKinds.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                        kind === k
                          ? "border-primary bg-primary/5 shadow-soft"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <span className="block font-medium">{IMPORT_SPECS[k].title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {IMPORT_SPECS[k].description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {spec && (
              <ol className="space-y-3">
                <li className="flex items-start gap-3 rounded-xl border border-border/80 bg-secondary/30 p-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Şablonu indirin</p>
                    <p className="text-xs text-muted-foreground">
                      {spec.templateFile
                        ? "Büronun kendi Excel şablonudur; sütunları değiştirmeden doldurup yükleyin."
                        : "Listeli sütunlarda (tür, müvekkil, dosya…) Excel'de açılır liste vardır. Açıklama sayfasında her sütun anlatılır."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadTemplate(spec, ctx)}
                  >
                    <Download /> Şablon
                  </Button>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-border/80 bg-secondary/30 p-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    2
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Doldurun ve yükleyin</p>
                    <p className="text-xs text-muted-foreground">
                      .xlsx veya .csv. Kendi tablonuzu da yükleyebilirsiniz; sütun başlıkları
                      şablondakilerle aynıysa tanınır.
                    </p>
                  </div>
                </li>
              </ol>
            )}

            {spec && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void loadFile(f);
                }}
                className={cn(
                  "flex min-h-[260px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-secondary/40",
                )}
              >
                {busy ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                ) : (
                  <FileSpreadsheet className="h-7 w-7 text-primary" />
                )}
                <p className="text-sm font-medium">
                  {busy ? "Dosya okunuyor..." : "Excel dosyasını seçin veya buraya sürükleyin"}
                </p>
                <p className="text-xs text-muted-foreground">
                  .xlsx, .csv · en fazla {MAX_ROWS} satır
                </p>
                <input
                  ref={input}
                  type="file"
                  accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void loadFile(f);
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          spec && (
            <>
              <div className="flex flex-col gap-3 border-b border-border/60 px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="slate" dot={false}>
                    {checked.length} satır
                  </StatusBadge>
                  <StatusBadge tone="green">{counts.ok} hazır</StatusBadge>
                  {counts.error > 0 && <StatusBadge tone="red">{counts.error} hatalı</StatusBadge>}
                  {counts.existing > 0 && (
                    <StatusBadge tone="amber">{counts.existing} zaten kayıtlı</StatusBadge>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {spec.softDuplicates && counts.existing > 0 && (
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--primary)]"
                          checked={includeExisting}
                          onChange={(e) => setIncludeExisting(e.target.checked)}
                        />
                        Kayıtlı görünenleri de aktar
                      </label>
                    )}
                    <Segmented
                      size="sm"
                      className="w-auto"
                      value={filter}
                      onChange={(v) => {
                        setFilter(v as typeof filter);
                        setPage(0);
                      }}
                      options={[
                        { value: "all", label: "Tümü" },
                        { value: "error", label: "Hatalı" },
                        { value: "ok", label: "Hazır" },
                      ]}
                    />
                  </div>
                </div>
                <BulkApply
                  key={kind}
                  spec={spec}
                  options={options}
                  multiOptions={multiOptions}
                  count={visible.length}
                  userName={currentUser.name}
                  onApply={applyToVisible}
                />
                {(info?.missing.length || info?.unknown.length || info?.truncated) && (
                  <div className="space-y-1 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {!!info?.missing.length && (
                      <p className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Dosyada zorunlu sütun yok: {info.missing.join(", ")}. Bu bilgiyi aşağıda
                        satır satır girebilirsiniz.
                      </p>
                    )}
                    {!!info?.unknown.length && (
                      <p>Tanınmayan sütunlar yok sayıldı: {info.unknown.join(", ")}</p>
                    )}
                    {info?.truncated && (
                      <p>İlk {MAX_ROWS} satır okundu; kalanını ayrı bir dosyayla aktarın.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <tr>
                      <th className="sticky left-0 z-20 w-12 border-b border-border/60 bg-muted/95 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                        #
                      </th>
                      <th className="min-w-[220px] border-b border-border/60 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Durum
                      </th>
                      {spec.columns.map((c) => (
                        <th
                          key={c.key}
                          title={c.hint}
                          style={{ minWidth: Math.max(130, (c.width ?? 16) * 8) }}
                          className="border-b border-border/60 px-2 py-2 text-left text-xs font-semibold text-muted-foreground"
                        >
                          {c.header}
                          {c.required && <span className="text-destructive"> *</span>}
                        </th>
                      ))}
                      <th className="w-10 border-b border-border/60" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "align-top",
                          r.status === "error" && "bg-rose-50/50 dark:bg-rose-950/15",
                          r.status === "existing" && "bg-amber-50/40 dark:bg-amber-950/10",
                        )}
                      >
                        <td className="sticky left-0 border-b border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground">
                          {r.line}
                        </td>
                        <td className="border-b border-border/50 px-3 py-2">
                          <StatusBadge
                            tone={
                              r.status === "ok" ? "green" : r.status === "error" ? "red" : "amber"
                            }
                          >
                            {r.status === "ok"
                              ? "Hazır"
                              : r.status === "error"
                                ? "Hatalı"
                                : "Atlanacak"}
                          </StatusBadge>
                          {spec.columns
                            .filter((c) => r.check.errors[c.key])
                            .map((c) => (
                              <p
                                key={c.key}
                                className="mt-1 text-[12.5px] leading-4 text-destructive"
                              >
                                <span className="font-medium">{c.header}:</span>{" "}
                                {r.check.errors[c.key]}
                              </p>
                            ))}
                          {r.problems.map((p) => (
                            <p key={p} className="mt-1 text-[12.5px] leading-4 text-muted-foreground">
                              {p}
                            </p>
                          ))}
                        </td>
                        {spec.columns.map((c) => {
                          const error = r.check.errors[c.key];
                          const value = r.values[c.key] ?? "";
                          const opts = options.get(c.key);
                          return (
                            <td key={c.key} className="border-b border-border/50 px-1.5 py-1.5">
                              {multiOptions.has(c.key) ? (
                                <MultiCombobox
                                  value={splitMulti(value)}
                                  onChange={(v) => update(r.id, c.key, v.join("; "))}
                                  options={multiOptions.get(c.key)!}
                                  placeholder={value || "Seçin"}
                                  invalid={!!error}
                                />
                              ) : opts ? (
                                <Combobox
                                  value={
                                    c.creatable || opts.some((o) => o.value === value)
                                      ? value || undefined
                                      : undefined
                                  }
                                  onChange={(v) => update(r.id, c.key, v)}
                                  options={opts}
                                  placeholder={value || "Seçin"}
                                  creatable={c.creatable}
                                  allowClear
                                  invalid={!!error}
                                />
                              ) : c.multiline ? (
                                <Textarea
                                  value={value}
                                  onChange={(e) => update(r.id, c.key, e.target.value)}
                                  rows={2}
                                  className="min-w-[280px] text-[13px]"
                                />
                              ) : (
                                <Input
                                  value={value}
                                  onChange={(e) => update(r.id, c.key, e.target.value)}
                                  placeholder={c.type === "date" ? "GG.AA.YYYY" : undefined}
                                  inputMode={c.type === "money" ? "decimal" : undefined}
                                  aria-invalid={!!error || undefined}
                                  className="h-10"
                                />
                              )}
                              {error && (
                                <p className="mt-1 max-w-[260px] text-[12.5px] leading-4 text-destructive">
                                  {error}
                                </p>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-border/50 px-1 py-1.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(r.id)}
                            aria-label="Satırı çıkar"
                            title="Satırı aktarımdan çıkar"
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={spec.columns.length + 3}
                          className="px-4 py-10 text-center text-sm text-muted-foreground"
                        >
                          {filter === "error" ? (
                            <span className="inline-flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Hatalı satır
                              kalmadı
                            </span>
                          ) : (
                            "Gösterilecek satır yok"
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 px-6 py-3.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setRows(null)}>
                    <ArrowLeft /> Başka dosya
                  </Button>
                  {counts.error > 0 && (
                    <Button variant="ghost" size="sm" onClick={downloadErrors}>
                      <Download /> Hatalıları Excel'e indir
                    </Button>
                  )}
                </div>
                {pages > 1 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground sm:mx-auto">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={current === 0}
                      onClick={() => setPage(current - 1)}
                      aria-label="Önceki sayfa"
                    >
                      <ChevronLeft />
                    </Button>
                    {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, visible.length)}{" "}
                    / {visible.length}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={current >= pages - 1}
                      onClick={() => setPage(current + 1)}
                      aria-label="Sonraki sayfa"
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 sm:ml-auto">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Vazgeç
                  </Button>
                  <Button disabled={!counts.ok || busy} loading={busy} onClick={commit}>
                    <Upload /> {counts.ok} {spec.noun} aktar
                  </Button>
                </div>
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
