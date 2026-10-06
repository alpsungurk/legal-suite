import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarCheck,
  Gavel,
  HandCoins,
  Pencil,
  Plus,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { enforcementSummary, promiseStatus } from "@/lib/finance";
import { formatDate, formatMoney, relativeDue, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { AvatarStack, Money, PageShell, ProgressBar } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { ENFORCEMENT_STATUSES, type EnforcementFile } from "@/lib/erp-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/icra/")({
  head: () => ({ meta: [{ title: "İcra dosyaları — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();

  const rows = state.enforcements.map((e) => ({ e, s: enforcementSummary(state, e.id) }));
  type R = (typeof rows)[number];
  const active = rows.filter((r) => r.e.status !== "Kapandı");
  const broken = state.promises.filter((p) => promiseStatus(p) === "Gecikmiş");
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const debtorNames = (e: EnforcementFile) =>
    e.debtorIds.map((id) => state.debtors.find((d) => d.id === id)?.name ?? "?");

  const columns: Column<R>[] = [
    {
      id: "no",
      header: "Dosya",
      sort: (r) => r.e.no,
      export: (r) => r.e.no,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{r.e.no}</p>
          <p className="truncate text-xs text-muted-foreground">{r.e.office}</p>
        </div>
      ),
    },
    {
      id: "parties",
      header: "Alacaklı → Borçlu",
      export: (r) => `${clientName(r.e.clientId)} → ${debtorNames(r.e).join(", ")}`,
      cell: (r) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{clientName(r.e.clientId)}</p>
          <p className="truncate text-xs text-muted-foreground">→ {debtorNames(r.e).join(", ")}</p>
        </div>
      ),
    },
    {
      id: "progress",
      header: "Tahsilat",
      hideBelow: "md",
      sort: (r) => r.s.progress,
      cell: (r) => (
        <div className="w-40">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{formatMoney(r.s.collected)}</span>
            <span>%{Math.round(r.s.progress * 100)}</span>
          </div>
          <ProgressBar value={r.s.progress} tone={r.s.progress >= 1 ? "green" : "primary"} />
        </div>
      ),
    },
    {
      id: "next",
      header: "Sıradaki söz",
      hideBelow: "lg",
      sort: (r) => r.s.nextPromise?.dueDate ?? "9999",
      cell: (r) =>
        r.s.nextPromise ? (
          <div className="text-sm">
            <Money value={r.s.nextPromise.amount} className="font-medium" />
            <p
              className={cn(
                "text-[11px]",
                r.s.overduePromises ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              {relativeDue(r.s.nextPromise.dueDate)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "resp",
      header: "Sorumlu",
      hideBelow: "xl",
      cell: (r) => (
        <AvatarStack
          names={r.e.responsibleIds.map((id) => state.users.find((u) => u.id === id)?.name ?? "?")}
        />
      ),
    },
    {
      id: "remaining",
      header: "Kalan alacak",
      align: "right",
      money: true,
      sort: (r) => r.s.remaining,
      export: (r) => r.s.remaining,
      cell: (r) => <Money value={r.s.remaining} className="font-semibold" />,
    },
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.e.status,
      export: (r) => r.e.status,
      cell: (r) => <StatusBadge status={r.e.status} />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="İcra dosyaları"
        description="Takipler, borçlular, ödeme sözleri ve tahsilatlar"
        icon={Gavel}
        actions={
          permissions.manageRecords && (
            <>
              <Button variant="outline" onClick={() => quick.open("promise")}>
                <CalendarCheck /> Ödeme sözü
              </Button>
              <Button
                onClick={() =>
                  quick.open("enforcement", {
                    onSaved: (e) => navigate({ to: "/icra/$id", params: { id: e.id } }),
                  })
                }
              >
                <Plus /> Yeni takip
              </Button>
            </>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Takipteki alacak"
          value={formatMoney(sumBy(active, (r) => r.s.claim))}
          icon={Target}
          tone="blue"
          hint={`${active.length} aktif dosya`}
        />
        <StatTile
          label="Tahsil edilen"
          value={formatMoney(sumBy(rows, (r) => r.s.collected))}
          icon={TrendingUp}
          tone="green"
        />
        <StatTile
          label="Kalan"
          value={formatMoney(sumBy(active, (r) => r.s.remaining))}
          icon={Wallet}
          tone="violet"
        />
        <StatTile
          label="Tutulmayan söz"
          value={broken.length}
          icon={AlertTriangle}
          tone={broken.length ? "red" : "green"}
          hint={broken.length ? formatMoney(sumBy(broken, (p) => p.amount)) : "Gecikme yok"}
          hintTone={broken.length ? "red" : "green"}
        />
      </StatGrid>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.e.id}
        searchText={(r) => [r.e.no, r.e.office, clientName(r.e.clientId), ...debtorNames(r.e)]}
        searchPlaceholder="Esas no, daire, alacaklı veya borçlu ara..."
        filters={[
          {
            id: "status",
            label: "Durum",
            options: [...ENFORCEMENT_STATUSES],
            get: (r) => r.e.status,
          },
          {
            id: "type",
            label: "Takip türü",
            options: [...new Set(state.enforcements.map((e) => e.type))],
            get: (r) => r.e.type,
          },
        ]}
        dateRange={{ label: "Takip tarihi", get: (r) => r.e.openingDate }}
        initialSort={{ id: "next" }}
        exportName="İcra dosyaları"
        onRowClick={(r) => navigate({ to: "/icra/$id", params: { id: r.e.id } })}
        rowActions={
          permissions.manageRecords
            ? (r) => (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      quick.open("collection", {
                        preset: { enforcementId: r.e.id, debtorId: r.e.debtorIds[0] },
                      })
                    }
                  >
                    <HandCoins /> Tahsilat gir
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      quick.open("promise", {
                        preset: { enforcementId: r.e.id, debtorId: r.e.debtorIds[0] },
                      })
                    }
                  >
                    <CalendarCheck /> Ödeme sözü
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => quick.open("enforcement", { record: r.e })}>
                    <Pencil /> Düzenle
                  </DropdownMenuItem>
                </>
              )
            : undefined
        }
        mobileCard={(r) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{r.e.no}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {debtorNames(r.e).join(", ")}
                </p>
              </div>
              <StatusBadge status={r.e.status} />
            </div>
            <ProgressBar value={r.s.progress} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(r.s.collected)} / {formatMoney(r.s.claim)} ·{" "}
              {formatDate(r.e.openingDate)}
            </p>
          </div>
        )}
      />
    </PageShell>
  );
}
