import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Plus, TrendingUp, Wallet, AlertCircle, Repeat } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { feeIncomeInRange, planSummary } from "@/lib/finance";
import { formatMoney, formatPeriod, sumBy, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Button } from "@/components/ui/button";
import { PlanTable } from "@/components/lists/tables";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";

export const Route = createFileRoute("/tahsilatlar")({
  head: () => ({ meta: [{ title: "Tahsilatlar — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions, accrueMonthlyFees } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const [planId, setPlanId] = useState<string | null>(null);
  if (!permissions.viewFinance) return <NoAccess />;

  const active = state.plans.filter((p) => !p.cancelled);
  const sums = active.map(planSummary);
  const t = today();
  const monthStart = `${t.slice(0, 7)}-01`;
  const period = t.slice(0, 7);
  const pendingAccrual = state.clients.filter(
    (c) =>
      c.status === "Aktif" &&
      c.monthlyFee &&
      !state.plans.some((p) => p.clientId === c.id && p.period === period && !p.cancelled),
  );

  return (
    <PageShell>
      <PageHeader
        title="Tahsilatlar"
        description="Vekalet ücreti ve aylık ücret planları, taksitler ve tahsil edilen ödemeler"
        icon={Wallet}
        actions={
          <>
            {pendingAccrual.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (
                    await confirm({
                      title: `${formatPeriod(period)} aylık ücretleri tahakkuk edilsin mi?`,
                      description: `${pendingAccrual.map((c) => c.name).join(", ")} için ${formatMoney(sumBy(pendingAccrual, (c) => c.monthlyFee ?? 0))} tutarında tahsilat planı oluşturulacak.`,
                      destructive: false,
                      confirmLabel: "Tahakkuk et",
                    })
                  ) {
                    const n = accrueMonthlyFees(period);
                    toast.success(`${n} müvekkil için aylık ücret oluşturuldu`);
                  }
                }}
              >
                <Repeat /> Aylık ücretleri tahakkuk et ({pendingAccrual.length})
              </Button>
            )}
            <Button onClick={() => quick.open("plan", { onSaved: (p) => setPlanId(p.id) })}>
              <Plus /> Yeni tahsilat planı
            </Button>
          </>
        }
      />
      <StatGrid>
        <StatTile
          label="Bu ay tahsil edilen"
          value={formatMoney(feeIncomeInRange(state, monthStart, t))}
          icon={TrendingUp}
          tone="green"
        />
        <StatTile
          label="Toplam alacak"
          value={formatMoney(sumBy(sums, (s) => s.remaining))}
          icon={Wallet}
          tone="blue"
          hint={`${active.filter((p, i) => sums[i].remaining > 0).length} açık plan`}
        />
        <StatTile
          label="Vadesi geçmiş"
          value={formatMoney(sumBy(sums, (s) => s.overdueAmount))}
          icon={AlertCircle}
          tone="red"
          hint={`${sums.filter((s) => s.overdueCount).length} planda gecikme`}
          hintTone="red"
          to="/taksitler"
        />
        <StatTile
          label="Tamamlanan plan"
          value={sums.filter((s) => s.status === "Tamamlandı").length}
          icon={CalendarCheck}
          tone="violet"
        />
      </StatGrid>
      <PlanTable rows={state.plans} onOpen={(p) => setPlanId(p.id)} />
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}
