import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, UserX } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { debtorSummary } from "@/lib/finance";
import { formatMoney, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, Money, PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { ReliabilityBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";

export const Route = createFileRoute("/borclular/")({
  head: () => ({ meta: [{ title: "Borçlular — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  const rows = state.debtors.map((d) => ({ d, s: debtorSummary(state, d.id) }));
  type R = (typeof rows)[number];

  const columns: Column<R>[] = [
    {
      id: "name",
      header: "Borçlu",
      sort: (r) => r.d.name,
      export: (r) => r.d.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.d.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.d.name}</p>
            <p className="text-xs text-muted-foreground">
              {r.d.kind}
              {r.d.identity && ` · ${r.d.identity}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "phone",
      header: "Telefon",
      hideBelow: "lg",
      export: (r) => r.d.phone,
      cell: (r) => <span className="text-sm">{r.d.phone ?? "—"}</span>,
    },
    {
      id: "files",
      header: "Dosya",
      align: "center",
      sort: (r) => r.s.files.length,
      export: (r) => r.s.files.length,
      cell: (r) => r.s.files.length,
    },
    {
      id: "claim",
      header: "Toplam borç",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.s.claim,
      export: (r) => r.s.claim,
      cell: (r) => <Money value={r.s.claim} className="text-muted-foreground" />,
    },
    {
      id: "collected",
      header: "Tahsil edilen",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.s.collected,
      export: (r) => r.s.collected,
      cell: (r) => (
        <Money value={r.s.collected} className="text-emerald-600 dark:text-emerald-400" />
      ),
    },
    {
      id: "remaining",
      header: "Kalan",
      align: "right",
      money: true,
      sort: (r) => r.s.remaining,
      export: (r) => r.s.remaining,
      cell: (r) => <Money value={r.s.remaining} className="font-semibold" />,
    },
    {
      id: "rel",
      header: "Söz sadakati",
      hideBelow: "lg",
      sort: (r) => r.s.reliability ?? -1,
      cell: (r) => <ReliabilityBadge value={r.s.reliability} />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Borçlular"
        description="Borçlu kartları: tüm icra dosyaları, sözler ve görüşmeler tek yerde"
        icon={UserX}
        actions={
          permissions.manageRecords && (
            <Button
              onClick={() =>
                quick.open("debtor", {
                  onSaved: (d) => navigate({ to: "/borclular/$id", params: { id: d.id } }),
                })
              }
            >
              <Plus /> Yeni borçlu
            </Button>
          )
        }
      />
      <StatGrid>
        <StatTile label="Borçlu" value={rows.length} icon={UserX} tone="blue" />
        <StatTile
          label="Toplam borç"
          value={formatMoney(sumBy(rows, (r) => r.s.claim))}
          tone="violet"
        />
        <StatTile
          label="Tahsil edilen"
          value={formatMoney(sumBy(rows, (r) => r.s.collected))}
          tone="green"
        />
        <StatTile
          label="Kalan"
          value={formatMoney(sumBy(rows, (r) => r.s.remaining))}
          tone="amber"
        />
      </StatGrid>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.d.id}
        searchText={(r) => [r.d.name, r.d.identity, r.d.phone]}
        searchPlaceholder="İsim, TC/VKN, telefon ara..."
        filters={[
          { id: "kind", label: "Tür", options: ["Bireysel", "Kurumsal"], get: (r) => r.d.kind },
        ]}
        initialSort={{ id: "remaining", desc: true }}
        exportName="Borçlular"
        onRowClick={(r) => navigate({ to: "/borclular/$id", params: { id: r.d.id } })}
        rowActions={
          permissions.manageRecords
            ? (r) => (
                <DropdownMenuItem onClick={() => quick.open("debtor", { record: r.d })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
              )
            : undefined
        }
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <Avatar name={r.d.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.d.name}</p>
              <p className="text-xs text-muted-foreground">{r.s.files.length} dosya</p>
            </div>
            <Money value={r.s.remaining} className="font-semibold" />
          </div>
        )}
      />
    </PageShell>
  );
}
