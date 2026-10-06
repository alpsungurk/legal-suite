import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Banknote,
  Building,
  Landmark,
  MinusCircle,
  Pencil,
  Plus,
  PlusCircle,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { accountBalances, accountLedger, type AccountEntry } from "@/lib/finance";
import { formatDate, formatIban, formatMoney, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Money, NoAccess, PageShell, Section } from "@/components/app/bits";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/banka-kasa")({
  head: () => ({ meta: [{ title: "Banka & Kasa — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions, remove, patch } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const balances = accountBalances(state);
  const [selected, setSelected] = useState<string>(balances[0]?.account.id ?? "");
  if (!permissions.viewFinance) return <NoAccess />;

  const acc = state.accounts.find((a) => a.id === selected) ?? state.accounts[0];
  const ledger = acc ? accountLedger(state, acc.id) : { entries: [], balance: 0 };
  const total = sumBy(
    balances.filter((b) => b.account.active),
    (b) => b.balance,
  );
  const clientName = (id?: string) => state.clients.find((c) => c.id === id)?.name;
  const untransferred = state.collections.filter((c) => !c.transferredToClient);

  const columns: Column<AccountEntry>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (e) => e.date,
      export: (e) => formatDate(e.date),
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</span>
      ),
    },
    {
      id: "desc",
      header: "Açıklama",
      export: (e) => e.description,
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{e.description}</p>
          {e.clientId && (
            <p className="truncate text-xs text-muted-foreground">{clientName(e.clientId)}</p>
          )}
        </div>
      ),
    },
    {
      id: "source",
      header: "Kaynak",
      hideBelow: "md",
      export: (e) => e.source,
      cell: (e) => (
        <StatusBadge tone={e.amount >= 0 ? "green" : "amber"} dot={false}>
          {e.source}
        </StatusBadge>
      ),
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (e) => e.amount,
      export: (e) => e.amount,
      cell: (e) => <Money value={e.amount} signed colored className="font-semibold" />,
    },
    {
      id: "balance",
      header: "Bakiye",
      align: "right",
      money: true,
      hideBelow: "md",
      export: (e) => e.balance,
      cell: (e) => <Money value={e.balance} className="text-muted-foreground" />,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Banka & Kasa"
        description="Hesap bakiyeleri, tüm para giriş-çıkışları ve virmanlar"
        icon={Landmark}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => quick.open("transfer", { preset: { fromId: acc?.id } })}
            >
              <ArrowLeftRight /> Virman
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                quick.open("tx", { preset: { accountId: acc?.id, category: "Diğer gider" } })
              }
            >
              <MinusCircle /> Gelir / gider
            </Button>
            <Button onClick={() => quick.open("account", { onSaved: (a) => setSelected(a.id) })}>
              <Plus /> Yeni hesap
            </Button>
          </>
        }
      />

      <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#143064] to-[#0c1c3f] p-5 text-white shadow-elevated">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
          <p className="text-[13px] text-white/70">Toplam varlık</p>
          <p className="money mt-2 text-[1.75rem] font-bold">{formatMoney(total)}</p>
          <p className="mt-1 text-xs text-white/60">
            {balances.filter((b) => b.account.active).length} aktif hesap
          </p>
        </div>
        {balances.map(({ account: a, balance }) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelected(a.id)}
            className={cn(
              "interactive-card group relative rounded-2xl border bg-card p-5 text-left shadow-soft",
              selected === a.id ? "border-primary ring-[3px] ring-primary/15" : "border-border/80",
              !a.active && "opacity-60",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl",
                  a.type === "Kasa"
                    ? "bg-amber-500/12 text-amber-600"
                    : "bg-blue-500/10 text-blue-600",
                )}
              >
                {a.type === "Kasa" ? (
                  <Banknote className="h-[18px] w-[18px]" />
                ) : (
                  <Building className="h-[18px] w-[18px]" />
                )}
              </span>
              {!a.active && <StatusBadge tone="slate">Pasif</StatusBadge>}
            </div>
            <p className="mt-3 truncate text-sm font-medium">{a.name}</p>
            <p className={cn("money text-xl font-bold", balance < 0 && "text-rose-600")}>
              {formatMoney(balance)}
            </p>
            {a.iban && (
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {formatIban(a.iban)}
              </p>
            )}
          </button>
        ))}
      </div>

      {acc && (
        <Section
          title={acc.name}
          description={`${acc.type}${acc.bankName ? ` · ${acc.bankName}` : ""} · ${ledger.entries.length} hareket`}
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  quick.open("tx", { preset: { accountId: acc.id, category: "Diğer gelir" } })
                }
              >
                <PlusCircle /> Gelir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  quick.open("tx", { preset: { accountId: acc.id, category: "Diğer gider" } })
                }
              >
                <MinusCircle /> Gider
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => quick.open("account", { record: acc })}
              >
                <Pencil /> Düzenle
              </Button>
            </>
          }
          bodyClassName="p-0"
        >
          <DataTable
            className="rounded-none border-0 shadow-none"
            rows={ledger.entries}
            columns={columns}
            getId={(e) => e.id}
            searchText={(e) => [e.description, e.source, clientName(e.clientId)]}
            filters={[
              {
                id: "src",
                label: "Kaynak",
                options: [
                  "Açılış",
                  "Avans",
                  "Masraf",
                  "Tahsilat",
                  "İcra",
                  "Virman",
                  "Aktarım",
                  "Diğer",
                ],
                get: (e) => e.source,
              },
            ]}
            dateRange={{ label: "Tarih", get: (e) => e.date }}
            initialSort={{ id: "date", desc: true }}
            exportName={`${acc.name} hareketleri`}
            rowActions={(e) => {
              const tx = state.transactions.find((t) => t.id === e.id);
              if (!tx) return null;
              return (
                <>
                  {tx.category !== "Virman" && (
                    <DropdownMenuItem onClick={() => quick.open("tx", { record: tx })}>
                      <Pencil /> Düzenle
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Hareket silinsin mi?",
                          description: tx.transferId
                            ? "Virmanın her iki bacağı da silinir."
                            : undefined,
                        })
                      ) {
                        const ids = tx.transferId
                          ? state.transactions
                              .filter((t) => t.transferId === tx.transferId)
                              .map((t) => t.id)
                          : [tx.id];
                        ids.forEach((id) => remove("transactions", id));
                        toast.success("Hareket silindi");
                      }
                    }}
                  >
                    <Trash2 /> Sil
                  </DropdownMenuItem>
                </>
              );
            }}
            mobileCard={(e) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.date)} · {e.source}
                  </p>
                </div>
                <Money value={e.amount} signed colored className="font-semibold" />
              </div>
            )}
          />
        </Section>
      )}

      {untransferred.length > 0 && (
        <Section
          title="Müvekkile aktarılacak icra tahsilatları"
          description="Borçludan tahsil edilip henüz müvekkile ödenmemiş tutarlar"
        >
          <ul className="divide-y divide-border/60">
            {untransferred.map((c) => {
              const ef = state.enforcements.find((e) => e.id === c.enforcementId);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{clientName(ef?.clientId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {ef?.no} · {formatDate(c.date)}
                    </p>
                  </div>
                  <Money value={c.amount} className="font-semibold" />
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: "Müvekkile aktarım yapılsın mı?",
                          description: `${formatMoney(c.amount)} ${clientName(ef?.clientId)} hesabına ödenmiş olarak işaretlenecek ve ${state.accounts.find((a) => a.id === c.accountId)?.name ?? "hesap"}tan çıkış yazılacak.`,
                          destructive: false,
                          confirmLabel: "Aktar",
                        })
                      ) {
                        patch("collections", c.id, { transferredToClient: true });
                        quick.open("tx", {
                          preset: {
                            category: "Müvekkile aktarım",
                            accountId: c.accountId,
                            clientId: ef?.clientId,
                            amount: c.amount,
                            description: `${ef?.no} tahsilatı müvekkile aktarıldı`,
                          },
                        });
                      }
                    }}
                  >
                    <Send /> Aktar
                  </Button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
