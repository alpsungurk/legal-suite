/**
 * Tahsilatlar ve Vekalet ücreti sayfalarının ortak içeriği: ücret taksitleri (ve Tahsilatlar'da
 * borçlu / icra ödemeleri) tek yerde. Vekalet (adminOnly) yalnızca yöneticinin gördüğü planları gösterir.
 *
 *   Bekleyen  → "Tahsil et"  → kendiliğinden "Tahsil edilenler"e geçer
 *   Tahsil edilenler → "Geri al" → kendiliğinden "Bekleyen"e döner
 */
import { useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Gavel,
  HandCoins,
  ListChecks,
  Lock,
  type LucideIcon,
  Plus,
  Repeat,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import {
  allInstallments,
  feeIncomeInRange,
  planModule,
  promiseStatus,
  type InstallmentRow,
} from "@/lib/finance";
import type { FeePlan, InstallmentPayment, PaymentPromise } from "@/lib/erp-types";
import {
  addDays,
  formatDate,
  formatMoney,
  formatPeriod,
  relativeDue,
  sumBy,
  today,
} from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Money, NoAccess, PageShell, TextLink } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PlanTable } from "@/components/lists/tables";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import { DateChip } from "@/components/dashboard/widgets";
import { cn } from "@/lib/utils";

const FEE_TABS = ["bekleyen", "tahsil-edilen", "borclu", "planlar"] as const;
export type FeesSearch = { sekme?: string };
export const validateFeesSearch = (s: Record<string, unknown>): FeesSearch => ({
  sekme: typeof s.sekme === "string" ? s.sekme : undefined,
});

/** Planın bu bölüme ait olup olmadığı (Vekalet: yalnızca admin'e özel planlar) */
const inSection = (p: FeePlan, adminOnly: boolean) => !!p.adminOnly === adminOnly;

export function FeesWorkspace({
  adminOnly,
  sekme,
  onTab,
}: {
  adminOnly: boolean;
  sekme?: string;
  onTab: (t: string) => void;
}) {
  const { state: fullState, permissions, accrueMonthlyFees } = useErp();
  const perm = permissions;
  const tabs = adminOnly ? FEE_TABS.filter((x) => x !== "borclu") : FEE_TABS;
  const tab = (tabs as readonly string[]).includes(sekme ?? "") ? sekme! : "bekleyen";
  const quick = useQuick();
  const confirm = useConfirm();
  const [planId, setPlanId] = useState<string | null>(null);
  const mod = adminOnly ? "vekalet" : "fees";
  if (!permissions.can(mod)) return <NoAccess />;

  // Bu bölümün planları; hesaplar (bekleyen, bu ay tahsil edilen) yalnızca bunlarla yapılır
  const plans = fullState.plans.filter((p) => inSection(p, adminOnly));
  const state = { ...fullState, plans };
  const t = today();
  const monthStart = `${t.slice(0, 7)}-01`;
  const period = t.slice(0, 7);
  const installments = allInstallments(state);
  const open = installments.filter((r) => r.status !== "Ödendi");
  const overdue = open.filter((r) => r.status === "Gecikmiş");
  const payments = state.plans.flatMap((plan) =>
    plan.installments.flatMap((inst, index) => inst.payments.map((pay) => ({ plan, index, pay }))),
  );
  const debtorOpen = state.promises.filter((p) => p.status === "Bekliyor");
  const pendingAccrual = adminOnly
    ? []
    : state.clients.filter(
        (c) =>
          c.status === "Aktif" &&
          c.monthlyFee &&
          !fullState.plans.some((p) => p.clientId === c.id && p.period === period && !p.cancelled),
      );
  const head: { title: string; description: string; icon: LucideIcon } = adminOnly
    ? {
        title: "Vekalet ücreti",
        description: "Yalnızca yöneticinin gördüğü vekalet ücretleri, taksitleri ve tahsilatları",
        icon: Lock,
      }
    : {
        title: "Tahsilatlar",
        description: "Bekleyen taksitler, alınan ödemeler ve borçlu ödemeleri tek yerde",
        icon: Wallet,
      };

  return (
    <PageShell>
      <PageHeader
        {...head}
        actions={
          <>
            {perm.can("fees", "create") && pendingAccrual.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (
                    await confirm({
                      title: `${formatPeriod(period)} aylık ücretleri oluşturulsun mu?`,
                      description: `${pendingAccrual.map((c) => c.name).join(", ")} için ${formatMoney(sumBy(pendingAccrual, (c) => c.monthlyFee ?? 0))} tutarında taksit oluşturulacak.`,
                      destructive: false,
                      confirmLabel: "Oluştur",
                    })
                  ) {
                    const n = accrueMonthlyFees(period);
                    toast.success(`${n} müvekkil için aylık ücret oluşturuldu`);
                  }
                }}
              >
                <Repeat /> Aylık ücretleri oluştur ({pendingAccrual.length})
              </Button>
            )}
            {perm.can(mod, "create") && (
              <Button
                onClick={() =>
                  quick.open("plan", {
                    preset: adminOnly ? { adminOnly: true, kind: "Vekalet ücreti" } : undefined,
                    onSaved: (p) => setPlanId(p.id),
                  })
                }
              >
                <Plus /> {adminOnly ? "Yeni vekalet ücreti" : "Yeni tahsilat planı"}
              </Button>
            )}
          </>
        }
      />
      <StatGrid>
        <StatTile
          label="Bu ay tahsil edilen"
          value={formatMoney(feeIncomeInRange(state, monthStart, t))}
          icon={TrendingUp}
          tone="green"
          hint="Ayın başından bugüne"
        />
        <StatTile
          label="Bekleyen"
          value={formatMoney(sumBy(open, (r) => r.remaining))}
          icon={Wallet}
          tone="blue"
          hint={`${open.length} taksit`}
        />
        <StatTile
          label="Vadesi geçmiş"
          value={formatMoney(sumBy(overdue, (r) => r.remaining))}
          icon={AlertCircle}
          tone="red"
          hint={`${overdue.length} taksit`}
          hintTone={overdue.length ? "red" : undefined}
        />
        {!adminOnly && (
          <StatTile
            label="Borçlulardan beklenen"
            value={formatMoney(sumBy(debtorOpen, (p) => p.amount))}
            icon={Gavel}
            tone="violet"
            hint={`${debtorOpen.length} icra taksiti / söz`}
          />
        )}
      </StatGrid>

      <Tabs value={tab} onValueChange={onTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            <TabsTrigger value="bekleyen">
              <HandCoins className="mr-1.5 h-4 w-4" /> Bekleyen ({open.length})
            </TabsTrigger>
            <TabsTrigger value="tahsil-edilen">
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Tahsil edilenler ({payments.length})
            </TabsTrigger>
            {!adminOnly && (
              <TabsTrigger value="borclu">
                <Gavel className="mr-1.5 h-4 w-4" /> Borçlu ödemeleri ({debtorOpen.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="planlar">
              <ListChecks className="mr-1.5 h-4 w-4" /> Planlar ({state.plans.length})
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="bekleyen" className="mt-4 space-y-3">
          <PendingTab rows={open} onOpenPlan={setPlanId} />
        </TabsContent>
        <TabsContent value="tahsil-edilen" className="mt-4">
          <PaidTab rows={payments} onOpenPlan={setPlanId} />
        </TabsContent>
        {!adminOnly && (
          <TabsContent value="borclu" className="mt-4 space-y-3">
            <DebtorTab />
          </TabsContent>
        )}
        <TabsContent value="planlar" className="mt-4">
          <PlanTable rows={state.plans} onOpen={(p) => setPlanId(p.id)} />
        </TabsContent>
      </Tabs>
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}

/* ───────────── Bekleyen taksitler ───────────── */

function PendingTab({
  rows: open,
  onOpenPlan,
}: {
  rows: InstallmentRow[];
  onOpenPlan: (id: string) => void;
}) {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const [view, setView] = useState("all");
  const t = today();
  const overdue = open.filter((r) => r.status === "Gecikmiş");
  const week = open.filter((r) => r.inst.dueDate >= t && r.inst.dueDate <= addDays(t, 7));
  const month = open.filter(
    (r) => r.inst.dueDate >= t && r.inst.dueDate.slice(0, 7) === t.slice(0, 7),
  );
  const rows =
    view === "overdue" ? overdue : view === "week" ? week : view === "month" ? month : open;
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const caseNo = (id?: string) => state.cases.find((c) => c.id === id)?.no;

  const columns: Column<InstallmentRow>[] = [
    {
      id: "due",
      header: "Vade",
      sort: (r) => r.inst.dueDate,
      export: (r) => formatDate(r.inst.dueDate),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <DateChip date={r.inst.dueDate} danger={r.status === "Gecikmiş"} />
          <span
            className={cn(
              "hidden text-xs sm:inline",
              r.status === "Gecikmiş"
                ? "font-medium text-rose-600 dark:text-rose-400"
                : "text-muted-foreground",
            )}
          >
            {relativeDue(r.inst.dueDate)}
          </span>
        </div>
      ),
    },
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => clientName(r.plan.clientId),
      export: (r) => clientName(r.plan.clientId),
      cell: (r) => (
        <div className="min-w-0">
          <TextLink to={`/muvekkiller/${r.plan.clientId}`}>{clientName(r.plan.clientId)}</TextLink>
          <p className="truncate text-xs text-muted-foreground">
            {r.plan.title}
            {caseNo(r.plan.caseId) && ` · ${caseNo(r.plan.caseId)}`}
          </p>
        </div>
      ),
    },
    {
      id: "no",
      header: "Taksit",
      hideBelow: "md",
      export: (r) => `${r.index + 1}/${r.plan.installments.length}`,
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.index + 1} / {r.plan.installments.length}
        </span>
      ),
    },
    {
      id: "remaining",
      header: "Kalan",
      align: "right",
      money: true,
      sort: (r) => r.remaining,
      export: (r) => r.remaining,
      cell: (r) => (
        <div>
          <Money value={r.remaining} className="font-semibold" />
          {r.paid > 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              {formatMoney(r.inst.amount)} taksitten
            </p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Durum",
      hideBelow: "md",
      export: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (r) =>
        permissions.can(planModule(r.plan), "edit") ? (
          <Button
            size="sm"
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              quick.open("payment", { plan: r.plan, installmentId: r.inst.id });
            }}
          >
            <HandCoins /> Tahsil et
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Segmented
        className="w-full sm:w-auto"
        value={view}
        onChange={setView}
        options={[
          { value: "overdue", label: `Gecikmiş (${overdue.length})` },
          { value: "week", label: "Bu hafta" },
          { value: "month", label: "Bu ay" },
          { value: "all", label: "Tümü" },
        ]}
      />
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.inst.id}
        searchText={(r) => [clientName(r.plan.clientId), r.plan.title, caseNo(r.plan.caseId)]}
        searchPlaceholder="Müvekkil veya plan ara..."
        initialSort={{ id: "due" }}
        exportName="Bekleyen taksitler"
        onRowClick={(r) => onOpenPlan(r.plan.id)}
        rowActions={(r) => (
          <DropdownMenuItem onClick={() => onOpenPlan(r.plan.id)}>
            <CalendarCheck /> Planı aç
          </DropdownMenuItem>
        )}
        footer={(visible) => (
          <tr>
            <td colSpan={99} className="px-4 py-3 text-right">
              <span className="mr-3 text-xs font-normal text-muted-foreground">Kalan toplam</span>
              <Money value={sumBy(visible, (r) => r.remaining)} />
            </td>
          </tr>
        )}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <DateChip date={r.inst.dueDate} danger={r.status === "Gecikmiş"} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{clientName(r.plan.clientId)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.plan.title} · {r.index + 1}/{r.plan.installments.length}
              </p>
            </div>
            <Money value={r.remaining} className="font-semibold" />
          </div>
        )}
      />
    </>
  );
}

/* ───────────── Tahsil edilenler ───────────── */

type PaidRow = { plan: FeePlan; index: number; pay: InstallmentPayment };

function PaidTab({ rows, onOpenPlan }: { rows: PaidRow[]; onOpenPlan: (id: string) => void }) {
  const { state, permissions, removeInstallmentPayment } = useErp();
  const confirm = useConfirm();
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const accountName = (id?: string) => state.accounts.find((a) => a.id === id)?.name ?? "—";
  const columns: Column<PaidRow>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (r) => r.pay.date,
      export: (r) => formatDate(r.pay.date),
      cell: (r) => <span className="text-muted-foreground">{formatDate(r.pay.date)}</span>,
    },
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => clientName(r.plan.clientId),
      export: (r) => clientName(r.plan.clientId),
      cell: (r) => (
        <div className="min-w-0">
          <TextLink to={`/muvekkiller/${r.plan.clientId}`}>{clientName(r.plan.clientId)}</TextLink>
          <p className="truncate text-xs text-muted-foreground">
            {r.plan.title} · {r.index + 1}. taksit
          </p>
        </div>
      ),
    },
    {
      id: "method",
      header: "Yöntem / hesap",
      hideBelow: "md",
      export: (r) => `${r.pay.method} · ${accountName(r.pay.accountId)}`,
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.pay.method} · {accountName(r.pay.accountId)}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (r) => r.pay.amount,
      export: (r) => r.pay.amount,
      cell: (r) => (
        <Money
          value={r.pay.amount}
          className="font-semibold text-emerald-600 dark:text-emerald-400 dark:text-emerald-400"
        />
      ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(r) => r.pay.id}
      searchText={(r) => [clientName(r.plan.clientId), r.plan.title, r.pay.method]}
      searchPlaceholder="Müvekkil veya plan ara..."
      dateRange={{ label: "Tarih", get: (r) => r.pay.date }}
      initialSort={{ id: "date", desc: true }}
      exportName="Tahsil edilenler"
      onRowClick={(r) => onOpenPlan(r.plan.id)}
      rowActions={(r) =>
        permissions.can(planModule(r.plan), "edit") ? (
          <DropdownMenuItem
            onClick={async () => {
              if (
                await confirm({
                  title: "Ödeme geri alınsın mı?",
                  description: `${clientName(r.plan.clientId)} · ${formatMoney(r.pay.amount)}. Taksit tekrar "Bekleyen"e döner.`,
                  confirmLabel: "Geri al",
                })
              ) {
                removeInstallmentPayment(r.plan.id, r.pay.id);
                toast.success("Ödeme geri alındı; taksit Bekleyen'e döndü");
              }
            }}
          >
            <Undo2 /> Geri al
          </DropdownMenuItem>
        ) : null
      }
      footer={(visible) => (
        <tr>
          <td colSpan={99} className="px-4 py-3 text-right">
            <span className="mr-3 text-xs font-normal text-muted-foreground">
              {visible.length} ödeme toplamı
            </span>
            <Money value={sumBy(visible, (r) => r.pay.amount)} />
          </td>
        </tr>
      )}
      mobileCard={(r) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{clientName(r.plan.clientId)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(r.pay.date)} · {r.plan.title}
            </p>
          </div>
          <Money value={r.pay.amount} className="font-semibold" />
        </div>
      )}
    />
  );
}

/* ───────────── Borçlu (icra) ödemeleri ───────────── */

function DebtorTab() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const [view, setView] = useState("open");
  const debtorName = (id: string) => state.debtors.find((d) => d.id === id)?.name ?? "—";
  const enf = (id: string) => state.enforcements.find((e) => e.id === id);
  const planSize = (p: PaymentPromise) =>
    p.planId ? state.promises.filter((x) => x.planId === p.planId).length : 0;
  const rows = state.promises.filter((p) =>
    view === "open" ? p.status === "Bekliyor" : p.status !== "Bekliyor",
  );
  const columns: Column<PaymentPromise>[] = [
    {
      id: "due",
      header: "Vade",
      sort: (p) => p.dueDate,
      export: (p) => formatDate(p.dueDate),
      cell: (p) => (
        <div className="flex items-center gap-3">
          <DateChip date={p.dueDate} danger={promiseStatus(p) === "Gecikmiş"} />
          {p.status === "Bekliyor" && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {relativeDue(p.dueDate)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "debtor",
      header: "Borçlu / icra dosyası",
      sort: (p) => debtorName(p.debtorId),
      export: (p) => `${debtorName(p.debtorId)} · ${enf(p.enforcementId)?.no ?? ""}`,
      cell: (p) => (
        <div className="min-w-0">
          <TextLink to={`/borclular/${p.debtorId}`}>{debtorName(p.debtorId)}</TextLink>
          <p className="truncate text-xs text-muted-foreground">
            <TextLink to={`/icra/${p.enforcementId}`}>{enf(p.enforcementId)?.no}</TextLink>
          </p>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Tür",
      hideBelow: "md",
      export: (p) => (p.planId ? `Taksit ${p.installmentNo}/${planSize(p)}` : "Ödeme sözü"),
      cell: (p) => (
        <span className="text-sm text-muted-foreground">
          {p.planId ? `Taksit ${p.installmentNo}/${planSize(p)}` : "Ödeme sözü"}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (p) => p.amount,
      export: (p) => p.amount,
      cell: (p) => <Money value={p.amount} className="font-semibold" />,
    },
    {
      id: "status",
      header: "Durum",
      export: (p) => promiseStatus(p),
      cell: (p) => <StatusBadge status={promiseStatus(p)} />,
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (p) =>
        p.status === "Bekliyor" && permissions.can("enforcements", "edit") ? (
          <Button
            size="sm"
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              quick.open("collection", {
                preset: {
                  enforcementId: p.enforcementId,
                  debtorId: p.debtorId,
                  amount: p.amount,
                  promiseId: p.id,
                },
              });
            }}
          >
            <CheckCircle2 /> Ödendi
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          className="w-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: "Bekleyen" },
            { value: "done", label: "Sonuçlanan" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Borçlu öderse "Ödendi"ye basın: tahsilat icra dosyasına yazılır, taksit "Sonuçlanan"a
          geçer. Bu para müvekkile aktarılacak paradır.
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(p) => p.id}
        searchText={(p) => [debtorName(p.debtorId), enf(p.enforcementId)?.no]}
        searchPlaceholder="Borçlu veya icra dosyası ara..."
        initialSort={{ id: "due", desc: view !== "open" }}
        exportName="Borçlu ödemeleri"
        mobileCard={(p) => (
          <div className="flex items-center gap-3">
            <DateChip date={p.dueDate} danger={promiseStatus(p) === "Gecikmiş"} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{debtorName(p.debtorId)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {enf(p.enforcementId)?.no} · {promiseStatus(p)}
              </p>
            </div>
            <Money value={p.amount} className="font-semibold" />
          </div>
        )}
      />
    </>
  );
}
