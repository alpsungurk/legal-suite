import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ListOrdered,
  Printer,
  Scale,
  Send,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { LedgerTable } from "@/components/lists/tables";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useErp } from "@/lib/erp-store";
import { clientFinance, clientLedger } from "@/lib/finance";
import { formatMoney, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, Money, NoAccess, PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/cari-hesap")({
  head: () => ({ meta: [{ title: "Cari hesap — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const navigate = useNavigate();
  // Satıra tıklayınca müvekkilin hareketleri yan panelde açılır; hareketler oradan silinebilir
  const [openId, setOpenId] = useState<string | null>(null);
  if (!permissions.can("ledger")) return <NoAccess />;
  const openClient = state.clients.find((c) => c.id === openId);
  const openFin = openClient ? clientFinance(state, openClient.id) : null;

  const rows = state.clients.map((c) => {
    const { entries } = clientLedger(state, c.id);
    const fin = clientFinance(state, c.id);
    return {
      client: c,
      debit: sumBy(entries, (e) => e.debit),
      credit: sumBy(entries, (e) => e.credit),
      fin,
      last: entries[entries.length - 1]?.date,
    };
  });
  type R = (typeof rows)[number];
  const debtors = rows.filter((r) => r.fin.status === "Borçlu");
  const creditors = rows.filter((r) => r.fin.status === "Alacaklı");

  const columns: Column<R>[] = [
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => r.client.name,
      export: (r) => r.client.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.client.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.client.name}</p>
            <p className="text-xs text-muted-foreground">{r.client.kind}</p>
          </div>
        </div>
      ),
    },
    {
      id: "debit",
      header: "Borç",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.debit,
      export: (r) => r.debit,
      cell: (r) => <Money value={r.debit} />,
    },
    {
      id: "credit",
      header: "Alacak",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.credit,
      export: (r) => r.credit,
      cell: (r) => <Money value={r.credit} className="text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />,
    },
    {
      id: "exp",
      header: "Yansıyan masraf",
      align: "right",
      money: true,
      hideBelow: "lg",
      sort: (r) => r.fin.expenseCharged,
      export: (r) => r.fin.expenseCharged,
      cell: (r) => <Money value={r.fin.expenseCharged} className="text-muted-foreground" />,
    },
    {
      id: "fee",
      header: "Ücret alacağı",
      align: "right",
      money: true,
      hideBelow: "lg",
      sort: (r) => r.fin.feeRemaining,
      export: (r) => r.fin.feeRemaining,
      cell: (r) => <Money value={r.fin.feeRemaining} className="text-muted-foreground" />,
    },
    {
      id: "balance",
      header: "Bakiye",
      align: "right",
      money: true,
      sort: (r) => r.fin.balance,
      export: (r) => r.fin.balance,
      cell: (r) => <Money value={Math.abs(r.fin.balance)} className="font-semibold" />,
    },
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.fin.status,
      export: (r) => r.fin.status,
      cell: (r) => (
        <StatusBadge status={r.fin.status} tone={r.fin.status === "Kapalı" ? "slate" : undefined} />
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Cari hesap"
        description="Masraf, ücret ve icra tahsilatlarını tek bakiyede birleştiren müvekkil hesapları"
        icon={BookOpenCheck}
      />
      <StatGrid>
        <StatTile
          label="Müvekkillerden alacak"
          value={formatMoney(sumBy(debtors, (r) => r.fin.balance))}
          icon={TrendingUp}
          tone="red"
          hint={`${debtors.length} borçlu müvekkil`}
        />
        <StatTile
          label="Müvekkillere borç"
          value={formatMoney(Math.abs(sumBy(creditors, (r) => r.fin.balance)))}
          icon={TrendingDown}
          tone="green"
          hint={`${creditors.length} alacaklı (icra / ödeme fazlası)`}
        />
        <StatTile
          label="Net pozisyon"
          value={formatMoney(sumBy(rows, (r) => r.fin.balance))}
          icon={Scale}
          tone="blue"
          hint="Müvekkil alacakları ile borçların farkı"
        />
        <StatTile
          label="İcra tahsilatı (aktarılmamış)"
          value={formatMoney(
            sumBy(
              state.collections.filter((c) => !c.transferredToClient),
              (c) => c.amount,
            ),
          )}
          icon={Send}
          tone="violet"
          hint="Müvekkile aktarılmayı bekleyen"
          to="/banka-kasa"
        />
      </StatGrid>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.client.id}
        searchText={(r) => [r.client.name]}
        filters={[
          {
            id: "st",
            label: "Durum",
            options: ["Borçlu", "Alacaklı", "Kapalı"],
            get: (r) => r.fin.status,
          },
        ]}
        initialSort={{ id: "balance", desc: true }}
        exportName="Cari hesaplar"
        onRowClick={(r) => setOpenId(r.client.id)}
        rowActions={(r) => (
          <>
            <DropdownMenuItem onClick={() => setOpenId(r.client.id)}>
              <ListOrdered /> Hareketler (düzenle / sil)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate({
                  to: "/muvekkiller/$id",
                  params: { id: r.client.id },
                  search: { sekme: "ekstre" },
                })
              }
            >
              <ArrowRight /> Müvekkil sayfasına git
            </DropdownMenuItem>
            {permissions.can("statements") && (
              <DropdownMenuItem asChild>
                <Link to="/yazdir/ekstre/$id" params={{ id: r.client.id }} target="_blank">
                  <Printer /> Ekstre yazdır
                </Link>
              </DropdownMenuItem>
            )}
          </>
        )}
        footer={(v) => (
          <tr>
            <td className="px-4 py-3 text-xs font-normal text-muted-foreground">Toplam</td>
            <td className="hidden px-4 py-3 text-right md:table-cell">
              <Money value={sumBy(v, (r) => r.debit)} />
            </td>
            <td className="hidden px-4 py-3 text-right md:table-cell">
              <Money value={sumBy(v, (r) => r.credit)} />
            </td>
            <td className="hidden lg:table-cell" />
            <td className="hidden lg:table-cell" />
            <td className="px-4 py-3 text-right">
              <Money value={sumBy(v, (r) => r.fin.balance)} />
            </td>
            <td />
            <td />
          </tr>
        )}
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{r.client.name}</span>
            <span className="flex items-center gap-2">
              <Money value={Math.abs(r.fin.balance)} className="font-semibold" />
              <StatusBadge status={r.fin.status} />
            </span>
          </div>
        )}
      />
      <p className="text-xs text-muted-foreground">
        Borç: müvekkile yansıtılan masraflar ve tahakkuk eden ücretler. Alacak: ücret tahsilatları
        ve müvekkil adına yapılan icra tahsilatları. Bakiye pozitifse müvekkil borçlu, negatifse
        alacaklıdır.
      </p>
      <Sheet open={!!openClient} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
          {openClient && openFin && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{openClient.name} · cari hareketler</SheetTitle>
                <SheetDescription>
                  Bakiye {formatMoney(Math.abs(openFin.balance))} ({openFin.status}). Bir hareketi
                  silmek için satırın sağındaki menüyü kullanın; silinen hareket asıl kaydından
                  (masraf, plan, tahsilat, aktarım) silinir.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/muvekkiller/$id",
                      params: { id: openClient.id },
                      search: { sekme: "ekstre" },
                    })
                  }
                >
                  <ArrowRight /> Müvekkil sayfası
                </Button>
                {permissions.can("statements") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/yazdir/ekstre/$id" params={{ id: openClient.id }} target="_blank">
                      <Printer /> Ekstre yazdır
                    </Link>
                  </Button>
                )}
              </div>
              <div className="mt-4">
                <LedgerTable clientId={openClient.id} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
