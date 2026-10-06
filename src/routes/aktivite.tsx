import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, History } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { formatDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, NoAccess, PageShell } from "@/components/app/bits";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ActivityLog } from "@/lib/erp-types";

export const Route = createFileRoute("/aktivite")({
  head: () => ({ meta: [{ title: "Aktivite geçmişi — Lex Yönetim" }] }),
  component: Page,
});

const FIELD_LABELS: Record<string, string> = {
  title: "Başlık",
  name: "Ad",
  amount: "Tutar",
  date: "Tarih",
  type: "Tür",
  status: "Durum",
  caseId: "Dosya",
  clientId: "Müvekkil",
  accountId: "Hesap",
  chargeTo: "Ait olduğu",
  paidBy: "Ödeyen",
  receipts: "Makbuzlar",
  note: "Not",
  total: "Toplam",
  installments: "Taksitler",
  responsibleIds: "Sorumlular",
  assigneeId: "Sorumlu",
  phone: "Telefon",
  email: "E-posta",
  role: "Rol",
  active: "Aktif",
  portalEnabled: "Portal",
  dueDate: "Vade",
  principal: "Asıl alacak",
};

function Page() {
  const { state, permissions } = useErp();
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  if (!permissions.viewActivity) return <NoAccess />;
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "Sistem";

  const columns: Column<ActivityLog>[] = [
    {
      id: "time",
      header: "Zaman",
      sort: (a) => a.createdAt,
      export: (a) => formatDateTime(a.createdAt),
      cell: (a) => (
        <div className="whitespace-nowrap text-sm">
          <p>{timeAgo(a.createdAt)}</p>
          <p className="text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</p>
        </div>
      ),
    },
    {
      id: "user",
      header: "Kullanıcı",
      sort: (a) => userName(a.actorId),
      export: (a) => userName(a.actorId),
      cell: (a) => (
        <div className="flex items-center gap-2">
          <Avatar name={userName(a.actorId)} size="xs" />
          <span className="text-sm">{userName(a.actorId)}</span>
        </div>
      ),
    },
    {
      id: "action",
      header: "İşlem",
      export: (a) => a.action,
      cell: (a) => <StatusBadge status={a.action} />,
    },
    {
      id: "entity",
      header: "Kayıt",
      hideBelow: "md",
      export: (a) => a.entity,
      cell: (a) => <span className="text-sm font-medium">{a.entity}</span>,
    },
    {
      id: "detail",
      header: "Detay",
      export: (a) => a.detail,
      cell: (a) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-sm">{a.detail}</p>
          {a.changes?.length ? (
            <p className="text-[11px] text-primary">{a.changes.length} alan değişti</p>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Aktivite geçmişi"
        description="Kim, neyi, ne zaman değiştirdi — alan bazında önce/sonra kaydı"
        icon={History}
      />
      <DataTable
        rows={state.activities}
        columns={columns}
        getId={(a) => a.id}
        searchText={(a) => [a.detail, a.entity, userName(a.actorId)]}
        filters={[
          {
            id: "user",
            label: "Kullanıcı",
            options: state.users.map((u) => u.name),
            get: (a) => userName(a.actorId),
          },
          {
            id: "action",
            label: "İşlem",
            options: ["Ekleme", "Güncelleme", "Silme", "İşlem"],
            get: (a) => a.action,
          },
          {
            id: "entity",
            label: "Kayıt türü",
            options: [...new Set(state.activities.map((a) => a.entity))],
            get: (a) => a.entity,
          },
        ]}
        dateRange={{ label: "Tarih", get: (a) => a.createdAt }}
        initialSort={{ id: "time", desc: true }}
        pageSize={50}
        exportName="Aktivite geçmişi"
        onRowClick={(a) => setSelected(a)}
        mobileCard={(a) => (
          <div>
            <p className="text-sm">
              <span className="font-medium">{userName(a.actorId)}</span> · {a.entity}{" "}
              {a.action.toLocaleLowerCase("tr")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {a.detail} · {timeAgo(a.createdAt)}
            </p>
          </div>
        )}
      />
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>
                  {selected.entity} · {selected.action}
                </SheetTitle>
                <SheetDescription>
                  {userName(selected.actorId)} · {formatDateTime(selected.createdAt)}
                </SheetDescription>
              </SheetHeader>
              <p className="mt-4 rounded-xl bg-secondary/50 p-3 text-sm">{selected.detail}</p>
              {selected.changes?.length ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-border/80">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Alan</th>
                        <th className="px-3 py-2 text-left font-medium">Önce</th>
                        <th className="w-6" />
                        <th className="px-3 py-2 text-left font-medium">Sonra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.changes.map((c) => (
                        <tr key={c.field} className="border-t border-border/60">
                          <td className="px-3 py-2 font-medium">
                            {FIELD_LABELS[c.field] ?? c.field}
                          </td>
                          <td className="px-3 py-2 text-rose-600 line-through decoration-rose-300 dark:text-rose-400">
                            {c.before}
                          </td>
                          <td className="text-muted-foreground">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </td>
                          <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">
                            {c.after}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Alan bazında değişiklik kaydı yok.
                </p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
