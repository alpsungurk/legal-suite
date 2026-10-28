import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { formatDateTime } from "@/lib/format";
import {
  describeCounts,
  listTrash,
  TRASH_DAYS,
  TRASH_LABELS,
  trashPurge,
  trashRestore,
  type TrashItem,
} from "@/lib/trash";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { EmptyState } from "@/components/EmptyState";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useConfirm } from "@/components/app/confirm";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeMoney, TrashDetails } from "@/components/app/TrashDetails";

export const Route = createFileRoute("/cop-kutusu")({
  head: () => ({ meta: [{ title: "Çöp Kutusu — Avukat Yönetim Paneli" }] }),
  component: Page,
});

const errorText = (e: unknown) =>
  e && typeof e === "object" && "message" in e ? String((e as Error).message) : String(e);

function daysLeft(deletedAt: string) {
  const passed = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000);
  return Math.max(TRASH_DAYS - passed, 0);
}

function Page() {
  const { state, permissions, reloadFromServer } = useErp();
  const confirm = useConfirm();
  const [rows, setRows] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TrashItem | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listTrash());
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  /** Sırayla geri yükler (bir müvekkil, sonra onun dosyası gibi bağımlılık sırası korunur) */
  const restore = async (items: TrashItem[]) => {
    let done = 0;
    for (const t of [...items].sort((a, b) => a.deletedAt.localeCompare(b.deletedAt))) {
      try {
        await trashRestore(t.id);
        done++;
      } catch (e) {
        toast.error(`${t.label || TRASH_LABELS[t.entity]}: ${errorText(e)}`);
      }
    }
    if (done) {
      toast.success(`${done} kayıt geri yüklendi`);
      await reloadFromServer();
    }
    await load();
    return done > 0;
  };

  const purge = async (items: TrashItem[]) => {
    const ok = await confirm({
      title: `${items.length} kayıt kalıcı olarak silinsin mi?`,
      description: "Bağlı kayıtları ve ekli dosyaları da kalıcı silinir. Bu işlem geri alınamaz.",
      confirmLabel: "Kalıcı sil",
    });
    if (!ok) return false;
    for (const t of items) {
      try {
        await trashPurge(t.id);
      } catch (e) {
        toast.error(errorText(e));
      }
    }
    toast.success("Kalıcı olarak silindi");
    await load();
    return true;
  };

  const userName = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "—";

  const columns: Column<TrashItem>[] = [
    {
      id: "label",
      header: "Silinen",
      sort: (t) => t.label,
      export: (t) => t.label,
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.label || "—"}</p>
          <p className="text-xs text-muted-foreground">{TRASH_LABELS[t.entity]}</p>
        </div>
      ),
    },
    {
      id: "with",
      header: "Birlikte silinenler",
      hideBelow: "md",
      export: (t) => describeCounts(t.counts, t.entity),
      cell: (t) => (
        <span className="text-sm text-muted-foreground">
          {describeCounts(t.counts, t.entity) || "—"}
        </span>
      ),
    },
    {
      id: "money",
      header: "Tutarlar",
      hideBelow: "md",
      export: (t) => describeMoney(t.amounts),
      cell: (t) => (
        <span className="text-sm">
          {describeMoney(t.amounts) || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      id: "by",
      header: "Silen",
      hideBelow: "lg",
      export: (t) => userName(t.deletedBy),
      cell: (t) => <span className="text-sm">{userName(t.deletedBy)}</span>,
    },
    {
      id: "at",
      header: "Silinme",
      sort: (t) => t.deletedAt,
      export: (t) => formatDateTime(t.deletedAt),
      cell: (t) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDateTime(t.deletedAt)}
        </span>
      ),
    },
    {
      id: "left",
      header: "Kalan",
      sort: (t) => daysLeft(t.deletedAt),
      export: (t) => `${daysLeft(t.deletedAt)} gün`,
      cell: (t) => {
        const d = daysLeft(t.deletedAt);
        return (
          <StatusBadge status={`${d} gün`} tone={d <= 3 ? "red" : d <= 10 ? "amber" : "slate"} />
        );
      },
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Çöp Kutusu"
        description={`Silinen kayıtlar bağlılarıyla birlikte ${TRASH_DAYS} gün saklanır; geri yüklenebilir, sonra kalıcı silinir`}
        icon={Trash2}
      />
      <DataTable
        rows={rows}
        columns={columns}
        getId={(t) => t.id}
        searchText={(t) => [t.label, TRASH_LABELS[t.entity], describeCounts(t.counts)]}
        searchPlaceholder="Silinen kayıt ara..."
        filters={[
          {
            id: "entity",
            label: "Tür",
            options: [...new Set(rows.map((t) => TRASH_LABELS[t.entity]))],
            get: (t) => TRASH_LABELS[t.entity],
          },
        ]}
        initialSort={{ id: "at", desc: true }}
        onRowClick={(t) => setDetail(t)}
        exportName="Çöp kutusu"
        empty={
          <EmptyState
            icon={Trash2}
            title={loading ? "Yükleniyor…" : "Çöp kutusu boş"}
            description={loading ? undefined : "Silinen kayıtlar burada görünür"}
            compact
          />
        }
        selectable
        bulkActions={(sel, clear) => (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={async () => (await restore(sel)) && clear()}
            >
              <Undo2 /> Geri yükle ({sel.length})
            </Button>
            {permissions.isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={async () => (await purge(sel)) && clear()}
              >
                <Trash2 /> Kalıcı sil
              </Button>
            )}
          </>
        )}
        rowActions={(t) => (
          <>
            <DropdownMenuItem onClick={() => setDetail(t)}>Ayrıntıyı gör</DropdownMenuItem>
            <DropdownMenuItem onClick={() => restore([t])}>
              <Undo2 /> Geri yükle
            </DropdownMenuItem>
            {permissions.isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => purge([t])}
                >
                  <Trash2 /> Kalıcı sil
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
        mobileCard={(t) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.label || TRASH_LABELS[t.entity]}</p>
              <p className="truncate text-xs text-muted-foreground">
                {TRASH_LABELS[t.entity]} · {formatDateTime(t.deletedAt)}
              </p>
            </div>
            <StatusBadge status={`${daysLeft(t.deletedAt)} gün`} tone="slate" />
          </div>
        )}
      />
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.label || (detail && TRASH_LABELS[detail.entity])}</DialogTitle>
            <DialogDescription>
              {detail &&
                `${formatDateTime(detail.deletedAt)} · ${daysLeft(detail.deletedAt)} gün sonra kalıcı silinir`}
            </DialogDescription>
          </DialogHeader>
          {detail && <TrashDetails money={detail.amounts} items={detail.items} />}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>
              Kapat
            </Button>
            {detail && (
              <Button
                onClick={async () => {
                  if (await restore([detail])) setDetail(null);
                }}
              >
                <Undo2 /> Geri yükle
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
