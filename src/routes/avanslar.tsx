import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PiggyBank, Plus, AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { advanceBalance } from "@/lib/finance";
import { formatMoney, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, Money, NoAccess, PageShell, ProgressBar } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AdvanceTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { StatusBadge } from "@/components/app/StatusBadge";

export const Route = createFileRoute("/avanslar")({
  head: () => ({ meta: [{ title: "Masraf avansları — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  if (!permissions.viewFinance) return <NoAccess />;

  const rows = state.clients
    .map((c) => ({ client: c, b: advanceBalance(state, c.id) }))
    .filter((r) => r.b.received || r.b.spent);
  type R = (typeof rows)[number];
  const low = rows.filter((r) => r.b.balance < (r.client.advanceThreshold ?? 0));

  const columns: Column<R>[] = [
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => r.client.name,
      export: (r) => r.client.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.client.name} size="sm" />
          <span className="font-medium">{r.client.name}</span>
        </div>
      ),
    },
    {
      id: "received",
      header: "Alınan",
      align: "right",
      money: true,
      sort: (r) => r.b.received,
      export: (r) => r.b.received,
      cell: (r) => <Money value={r.b.received} />,
    },
    {
      id: "spent",
      header: "Harcanan",
      align: "right",
      money: true,
      sort: (r) => r.b.spent,
      export: (r) => r.b.spent,
      cell: (r) => <Money value={r.b.spent} className="text-muted-foreground" />,
    },
    {
      id: "usage",
      header: "Kullanım",
      hideBelow: "md",
      sort: (r) => (r.b.received ? r.b.spent / r.b.received : 9),
      cell: (r) => {
        const u = r.b.received ? r.b.spent / r.b.received : 1;
        return (
          <div className="w-32">
            <ProgressBar value={u} tone={u >= 1 ? "red" : u > 0.8 ? "amber" : "green"} />
            <p className="mt-1 text-[11px] text-muted-foreground">%{Math.round(u * 100)}</p>
          </div>
        );
      },
    },
    {
      id: "balance",
      header: "Bakiye",
      align: "right",
      money: true,
      sort: (r) => r.b.balance,
      export: (r) => r.b.balance,
      cell: (r) => <Money value={r.b.balance} colored className="font-semibold" />,
    },
    {
      id: "state",
      header: "Durum",
      hideBelow: "lg",
      cell: (r) =>
        r.b.balance < 0 ? (
          <StatusBadge tone="red">Eksi bakiye</StatusBadge>
        ) : r.b.balance < (r.client.advanceThreshold ?? 0) ? (
          <StatusBadge tone="amber">Avans iste</StatusBadge>
        ) : (
          <StatusBadge tone="green">Yeterli</StatusBadge>
        ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Masraf avansları"
        description="Müvekkillerden masraflar için alınan avanslar ve kalan bakiyeler"
        icon={PiggyBank}
        actions={
          <Button onClick={() => quick.open("advance")}>
            <Plus /> Avans al
          </Button>
        }
      />
      <StatGrid>
        <StatTile
          label="Toplam alınan"
          value={formatMoney(sumBy(rows, (r) => r.b.received))}
          icon={ArrowDownLeft}
          tone="green"
        />
        <StatTile
          label="Harcanan"
          value={formatMoney(sumBy(rows, (r) => r.b.spent))}
          icon={ArrowUpRight}
          tone="amber"
        />
        <StatTile
          label="Kalan bakiye"
          value={formatMoney(sumBy(rows, (r) => r.b.balance))}
          icon={PiggyBank}
          tone="blue"
        />
        <StatTile
          label="Avans istenecek"
          value={low.length}
          icon={AlertTriangle}
          tone={low.length ? "red" : "green"}
          hint={
            low.length
              ? `${formatMoney(
                  Math.abs(
                    sumBy(
                      low.filter((r) => r.b.balance < 0),
                      (r) => r.b.balance,
                    ),
                  ),
                )} eksi bakiye`
              : "Tüm bakiyeler yeterli"
          }
          hintTone={low.length ? "red" : "green"}
        />
      </StatGrid>
      <Tabs defaultValue="bakiyeler">
        <TabsList>
          <TabsTrigger value="bakiyeler">Müvekkil bakiyeleri</TabsTrigger>
          <TabsTrigger value="hareketler">Avans hareketleri ({state.advances.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bakiyeler" className="mt-4">
          <DataTable
            rows={rows}
            columns={columns}
            getId={(r) => r.client.id}
            searchText={(r) => [r.client.name]}
            initialSort={{ id: "balance" }}
            exportName="Avans bakiyeleri"
            onRowClick={(r) =>
              navigate({
                to: "/muvekkiller/$id",
                params: { id: r.client.id },
                search: { sekme: "avanslar" },
              })
            }
            rowActions={(r) => (
              <DropdownMenuItem
                onClick={() => quick.open("advance", { preset: { clientId: r.client.id } })}
              >
                <Plus /> Avans al
              </DropdownMenuItem>
            )}
            mobileCard={(r) => (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{r.client.name}</span>
                <Money value={r.b.balance} colored className="font-semibold" />
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="hareketler" className="mt-4">
          <AdvanceTable rows={state.advances} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
