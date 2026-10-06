import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  ListFilter,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { matches } from "@/lib/format";
import { downloadExcel, type ExcelCell } from "@/lib/excel";
import { EmptyState } from "@/components/EmptyState";
import { Inbox } from "lucide-react";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  /** Excel'e yazılacak değer; verilmezse sütun dışa aktarılmaz */
  export?: (row: T) => ExcelCell;
  money?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  /** Bu genişliğin altında gizle */
  hideBelow?: "md" | "lg" | "xl";
};

export type TableFilter<T> = {
  id: string;
  label: string;
  options: string[];
  get: (row: T) => string | string[] | undefined;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  searchText?: (row: T) => Array<string | number | undefined | null>;
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  dateRange?: { label: string; get: (row: T) => string | undefined };
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  exportName?: string;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: { id: string; desc?: boolean };
  mobileCard?: (row: T) => ReactNode;
  footer?: (visible: T[]) => ReactNode;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
};

const hideClass = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};
const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

export function DataTable<T>({
  rows,
  columns,
  getId,
  searchText,
  searchPlaceholder = "Ara...",
  filters = [],
  dateRange,
  onRowClick,
  rowActions,
  selectable,
  bulkActions,
  toolbar,
  exportName,
  empty,
  pageSize = 25,
  initialSort,
  mobileCard,
  footer,
  rowClassName,
  className,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(
    initialSort ? { id: initialSort.id, desc: !!initialSort.desc } : null,
  );
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    Object.values(filterValues).filter((v) => v && v !== "__all").length + (from || to ? 1 : 0);

  const visible = useMemo(() => {
    let out = rows.filter((row) => {
      if (query && searchText && !matches(query, ...searchText(row))) return false;
      for (const f of filters) {
        const v = filterValues[f.id];
        if (!v || v === "__all") continue;
        const got = f.get(row);
        if (Array.isArray(got) ? !got.includes(v) : got !== v) return false;
      }
      if (dateRange && (from || to)) {
        const d = dateRange.get(row)?.slice(0, 10);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sort) {
        const get = col.sort;
        out = [...out].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          const r =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb), "tr");
          return sort.desc ? -r : r;
        });
      }
    }
    return out;
  }, [rows, query, searchText, filters, filterValues, dateRange, from, to, sort, columns]);

  useEffect(() => setPage(0), [query, filterValues, from, to]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(getId(r))),
    [rows, selected, getId],
  );
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(getId(r)));
  const clearSelection = () => setSelected(new Set());

  const toggleSort = (id: string) => {
    setSort((s) => (!s || s.id !== id ? { id, desc: false } : !s.desc ? { id, desc: true } : null));
  };

  const doExport = () => {
    const cols = columns.filter((c) => c.export);
    downloadExcel(
      exportName ?? "Liste",
      cols.map((c) => ({ header: c.header, money: c.money })),
      visible.map((r) => cols.map((c) => c.export!(r))),
    );
  };

  const hasToolbarFilters = filters.length > 0 || !!dateRange;
  const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft animate-fade-up",
        className,
      )}
    >
      {/* Araç çubuğu */}
      <div className="flex flex-col gap-3 border-b border-border/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {searchText && (
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 bg-secondary/40 pl-9 pr-8"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Aramayı temizle"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {hasToolbarFilters && (
            <Button
              variant={showFilters || activeFilterCount ? "soft" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setShowFilters((v) => !v)}
            >
              <ListFilter /> Filtre
              {activeFilterCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {toolbar}
            {exportName && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={doExport}
                title="Excel olarak indir"
              >
                <Download /> <span className="hidden sm:inline">Excel</span>
              </Button>
            )}
          </div>
        </div>

        {showFilters && hasToolbarFilters && (
          <div className="grid grid-cols-1 gap-2 animate-fade-up sm:grid-cols-2 lg:grid-cols-4">
            {filters.map((f) => (
              <Select
                key={f.id}
                value={filterValues[f.id] ?? "__all"}
                onValueChange={(v) => setFilterValues((p) => ({ ...p, [f.id]: v }))}
              >
                <SelectTrigger className="h-9">
                  <span className="truncate text-muted-foreground">{f.label}:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Tümü</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            {dateRange && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9"
                  aria-label={`${dateRange.label} başlangıç`}
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9"
                  aria-label={`${dateRange.label} bitiş`}
                />
              </div>
            )}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 justify-self-start"
                onClick={() => {
                  setFilterValues({});
                  setFrom("");
                  setTo("");
                }}
              >
                <X /> Temizle
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Toplu işlem çubuğu */}
      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/[0.04] px-4 py-2 animate-fade-up">
          <span className="text-sm font-medium">{selectedRows.length} kayıt seçildi</span>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions?.(selectedRows, clearSelection)}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clearSelection}>
            Seçimi kaldır
          </Button>
        </div>
      )}

      {/* Masaüstü tablo */}
      <div className={cn("overflow-x-auto", mobileCard && "hidden md:block")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const r of pageRows) {
                          if (v) next.add(getId(r));
                          else next.delete(getId(r));
                        }
                        return next;
                      })
                    }
                    aria-label="Tümünü seç"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground",
                    alignClass[c.align ?? "left"],
                    c.hideBelow && hideClass[c.hideBelow],
                  )}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
                        sort?.id === c.id && "text-foreground",
                      )}
                    >
                      {c.header}
                      {sort?.id === c.id ? (
                        sort.desc ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
              {rowActions && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const id = getId(row);
              const isSel = selected.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "group border-b border-border/50 transition-colors last:border-0 animate-fade-up",
                    onRowClick && "cursor-pointer hover:bg-secondary/50",
                    isSel && "bg-primary/[0.04]",
                    rowClassName?.(row),
                  )}
                  style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={(v) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(id);
                            else next.delete(id);
                            return next;
                          })
                        }
                        aria-label="Seç"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-4 py-3 align-middle",
                        alignClass[c.align ?? "left"],
                        c.hideBelow && hideClass[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu>{rowActions(row)}</RowMenu>
                    </td>
                  )}
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr>
                <td colSpan={colSpan}>
                  {empty ?? (
                    <EmptyState
                      icon={Inbox}
                      title={rows.length ? "Sonuç bulunamadı" : "Henüz kayıt yok"}
                      description={
                        rows.length ? "Arama veya filtreleri değiştirmeyi deneyin." : undefined
                      }
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
          {footer && pageRows.length > 0 && (
            <tfoot className="border-t border-border/80 bg-muted/30 text-sm font-semibold">
              {footer(visible)}
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobil kartlar */}
      {mobileCard && (
        <div className="divide-y divide-border/60 md:hidden">
          {pageRows.map((row) => (
            <div
              key={getId(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "flex items-start gap-3 p-4 transition-colors",
                onRowClick && "active:bg-secondary/60",
              )}
            >
              <div className="min-w-0 flex-1">{mobileCard(row)}</div>
              {rowActions && (
                <div onClick={(e) => e.stopPropagation()}>
                  <RowMenu>{rowActions(row)}</RowMenu>
                </div>
              )}
            </div>
          ))}
          {!pageRows.length &&
            (empty ?? (
              <EmptyState
                icon={Inbox}
                title={rows.length ? "Sonuç bulunamadı" : "Henüz kayıt yok"}
              />
            ))}
        </div>
      )}

      {/* Sayfalama */}
      {visible.length > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, visible.length)} /{" "}
            {visible.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 font-medium text-foreground">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowMenu({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100 data-[state=open]:bg-secondary data-[state=open]:opacity-100"
          aria-label="İşlemler"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
