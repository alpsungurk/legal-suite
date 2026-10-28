/** Kalan ödemeler: silinen kayıtlarda bize ödenmiş, kalıcı defterde saklanan para (kasa bakiyesine dahil) */
import { Landmark, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import type { PaymentLedgerEntry } from "@/lib/erp-types";
import { formatDate, formatMoney, sumBy } from "@/lib/format";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Money } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { useConfirm } from "@/components/app/confirm";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function PaymentLedgerTable() {
  const { state, permissions, removeMany } = useErp();
  const confirm = useConfirm();
  const canDelete = permissions.can("accounts", "delete");
  const rows = state.paymentLedger;
  const accountName = (id?: string) => state.accounts.find((a) => a.id === id)?.name ?? "—";

  const remove = async (list: PaymentLedgerEntry[]) => {
    const total = sumBy(list, (l) => l.amount);
    const ok = await confirm({
      title: `${list.length} kalan ödeme silinsin mi?`,
      description: `${formatMoney(total)} defterden silinir; ilgili hesabın bakiyesi o kadar düşer. Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
    });
    if (!ok) return false;
    removeMany(
      "paymentLedger",
      list.map((l) => l.id),
    );
    toast.success("Kalan ödeme silindi");
    return true;
  };

  const columns: Column<PaymentLedgerEntry>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (l) => l.date,
      export: (l) => formatDate(l.date),
      cell: (l) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(l.date)}</span>
      ),
    },
    {
      id: "client",
      header: "Müvekkil",
      sort: (l) => l.clientName,
      export: (l) => l.clientName,
      cell: (l) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{l.clientName || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{l.source}</p>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Tür",
      hideBelow: "md",
      export: (l) => l.kind,
      cell: (l) => <span className="text-sm text-muted-foreground">{l.kind}</span>,
    },
    {
      id: "account",
      header: "Hesap",
      hideBelow: "lg",
      export: (l) => accountName(l.accountId),
      cell: (l) => <span className="text-sm">{accountName(l.accountId)}</span>,
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (l) => l.amount,
      export: (l) => l.amount,
      cell: (l) => (
        <Money value={l.amount} className="font-semibold text-emerald-600 dark:text-emerald-400" />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <StatGrid>
        <StatTile
          label="Kalan ödemeler"
          value={formatMoney(sumBy(rows, (l) => l.amount))}
          icon={Wallet}
          tone="green"
          hint={`${rows.length} kayıt · silinen kayıtlardan kalan`}
        />
        <StatTile
          label="Hesaplara dahil"
          value={formatMoney(
            sumBy(
              rows.filter((l) => l.accountId),
              (l) => l.amount,
            ),
          )}
          icon={Landmark}
          tone="blue"
          hint="Banka / kasa bakiyesinde sayılır"
        />
      </StatGrid>
      <p className="text-xs text-muted-foreground">
        Müvekkil ya da dosya silinince, o kayıttaki bize ödenmiş para burada kalır ve hesap
        bakiyesini bozmaz. Yanlış girilmiş bir ödemeyse satırı silebilirsiniz; hesap bakiyesi o
        kadar düşer. Kayıt çöp kutusundan geri yüklenirse buradaki karşılığı kendiliğinden kalkar.
      </p>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(l) => l.id}
        searchText={(l) => [l.clientName, l.source, l.kind, accountName(l.accountId)]}
        searchPlaceholder="Müvekkil veya kaynak ara..."
        filters={[
          {
            id: "kind",
            label: "Tür",
            options: [...new Set(rows.map((l) => l.kind))],
            get: (l) => l.kind,
          },
        ]}
        dateRange={{ label: "Tarih", get: (l) => l.date }}
        initialSort={{ id: "date", desc: true }}
        exportName="Kalan ödemeler"
        selectable={canDelete}
        bulkActions={(sel, clear) => (
          <Button
            size="sm"
            variant="destructive"
            className="h-8"
            onClick={async () => (await remove(sel)) && clear()}
          >
            <Trash2 /> Seçilenleri sil ({sel.length})
          </Button>
        )}
        rowActions={
          canDelete
            ? (l) => (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => remove([l])}
                >
                  <Trash2 /> Sil
                </DropdownMenuItem>
              )
            : undefined
        }
        footer={(visible) => (
          <tr>
            <td colSpan={99} className="px-4 py-3 text-right">
              <span className="mr-3 text-xs font-normal text-muted-foreground">
                {visible.length} kayıt toplamı
              </span>
              <Money value={sumBy(visible, (l) => l.amount)} />
            </td>
          </tr>
        )}
        mobileCard={(l) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{l.clientName || l.source}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDate(l.date)} · {l.kind}
              </p>
            </div>
            <Money value={l.amount} className="font-semibold" />
          </div>
        )}
      />
    </div>
  );
}
