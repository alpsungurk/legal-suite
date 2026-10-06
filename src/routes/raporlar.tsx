import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Download,
  Hourglass,
  Percent,
  PiggyBank,
  Printer,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { accountBalances, allInstallments, monthlySeries, receivableAging } from "@/lib/finance";
import {
  addDays,
  formatDate,
  formatMoney,
  formatPeriod,
  monthKey,
  sumBy,
  today,
} from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, Money, NoAccess, PageShell, Section } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadWorkbook } from "@/lib/excel";
import { CashflowChart } from "@/components/dashboard/widgets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/raporlar")({
  head: () => ({ meta: [{ title: "Raporlar — Lex Yönetim" }] }),
  component: Page,
});

function rangeFor(preset: string): { from: string; to: string } {
  const t = today();
  if (preset === "month") return { from: `${t.slice(0, 7)}-01`, to: t };
  if (preset === "quarter") return { from: addDays(t, -90), to: t };
  if (preset === "year") return { from: `${t.slice(0, 4)}-01-01`, to: t };
  return { from: addDays(t, -365), to: t };
}

function Page() {
  const { state, permissions } = useErp();
  const [preset, setPreset] = useState("quarter");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const { from, to } = custom ?? rangeFor(preset);

  const data = useMemo(() => {
    const inRange = (d: string) => d >= from && d <= to;
    const payments = state.plans.flatMap((p) =>
      p.installments.flatMap((i) =>
        i.payments.filter((pay) => inRange(pay.date)).map((pay) => ({ ...pay, plan: p })),
      ),
    );
    const income =
      sumBy(payments, (p) => p.amount) +
      sumBy(
        state.transactions.filter((t) => t.category === "Diğer gelir" && inRange(t.date)),
        (t) => t.amount,
      );
    const officeExp =
      sumBy(
        state.expenses.filter((e) => e.chargeTo === "Büro" && inRange(e.date)),
        (e) => e.amount,
      ) +
      sumBy(
        state.transactions.filter((t) => t.category === "Diğer gider" && inRange(t.date)),
        (t) => Math.abs(t.amount),
      );
    const clientExp = sumBy(
      state.expenses.filter((e) => e.chargeTo === "Müvekkil" && inRange(e.date)),
      (e) => e.amount,
    );
    const net = income - officeExp;
    const margin = income > 0 ? net / income : null;

    // Tahsilat oranı: aralıkta vadesi gelen taksitlerin ödenen kısmı
    const dueRows = allInstallments(state).filter((r) => inRange(r.inst.dueDate));
    const dueTotal = sumBy(dueRows, (r) => r.inst.amount);
    const duePaid = sumBy(dueRows, (r) => r.paid);
    const collectionRate = dueTotal > 0 ? duePaid / dueTotal : null;

    // Nakit yeterliliği: son 6 ayın ortalama büro gideri
    const series6 = monthlySeries(state, 6);
    const avgExp = sumBy(series6, (s) => s.officeExpense) / 6;
    const cash = sumBy(
      accountBalances(state).filter((b) => b.account.active),
      (b) => b.balance,
    );
    const runway = avgExp > 0 ? cash / avgExp : null;

    // Müvekkil bazında
    const byClient = state.clients
      .map((c) => {
        const collected = sumBy(
          payments.filter((p) => p.plan.clientId === c.id),
          (p) => p.amount,
        );
        const exp = sumBy(
          state.expenses.filter(
            (e) =>
              inRange(e.date) &&
              e.chargeTo === "Müvekkil" &&
              (e.clientId === c.id ||
                state.cases.find((x) => x.id === e.caseId)?.clientId === c.id),
          ),
          (e) => e.amount,
        );
        const open = sumBy(
          allInstallments(state).filter((r) => r.plan.clientId === c.id && r.status !== "Ödendi"),
          (r) => r.remaining,
        );
        return { client: c, collected, exp, open };
      })
      .filter((r) => r.collected || r.exp || r.open)
      .sort((a, b) => b.collected - a.collected);

    // Avukat iş yükü
    const byLawyer = state.users
      .filter((u) => u.role !== "Müvekkil" && u.active)
      .map((u) => ({
        user: u,
        openCases: state.cases.filter(
          (c) => c.responsibleIds.includes(u.id) && c.status !== "Kapalı",
        ).length,
        tasks: state.reminders.filter((r) => r.assigneeId === u.id && inRange(r.date)).length,
        done: state.reminders.filter(
          (r) => r.assigneeId === u.id && inRange(r.date) && r.status === "Tamamlandı",
        ).length,
        late: state.reminders.filter(
          (r) => r.assigneeId === u.id && r.status === "Bekliyor" && r.date < today(),
        ).length,
        expenses: sumBy(
          state.expenses.filter((e) => e.createdBy === u.id && inRange(e.date)),
          (e) => e.amount,
        ),
      }));

    // Masraf türü
    const byType = new Map<string, number>();
    for (const e of state.expenses.filter((e) => inRange(e.date)))
      byType.set(e.type, (byType.get(e.type) ?? 0) + e.amount);
    const types = [...byType.entries()].sort((a, b) => b[1] - a[1]);

    // Aylık tablo
    const months = new Map<string, { income: number; office: number; client: number }>();
    for (const p of payments) {
      const k = monthKey(p.date);
      const m = months.get(k) ?? { income: 0, office: 0, client: 0 };
      m.income += p.amount;
      months.set(k, m);
    }
    for (const e of state.expenses.filter((e) => inRange(e.date))) {
      const k = monthKey(e.date);
      const m = months.get(k) ?? { income: 0, office: 0, client: 0 };
      if (e.chargeTo === "Büro") m.office += e.amount;
      else m.client += e.amount;
      months.set(k, m);
    }
    const monthRows = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return {
      income,
      officeExp,
      clientExp,
      net,
      margin,
      collectionRate,
      dueTotal,
      duePaid,
      cash,
      runway,
      byClient,
      byLawyer,
      types,
      monthRows,
      aging: receivableAging(state),
    };
  }, [state, from, to]);

  if (!permissions.viewReports) return <NoAccess />;

  const exportAll = () =>
    downloadWorkbook(`Rapor ${from} ${to}`, [
      {
        name: "Özet",
        columns: [{ header: "Gösterge" }, { header: "Değer" }],
        rows: [
          ["Dönem", `${formatDate(from)} - ${formatDate(to)}`],
          ["Tahsilat", data.income],
          ["Büro gideri", data.officeExp],
          ["Net", data.net],
          ["Kâr marjı (%)", data.margin == null ? "" : Math.round(data.margin * 100)],
          [
            "Tahsilat oranı (%)",
            data.collectionRate == null ? "" : Math.round(data.collectionRate * 100),
          ],
          ["Müvekkil masrafları", data.clientExp],
          ["Kasa + banka", data.cash],
        ],
      },
      {
        name: "Aylık",
        columns: [
          { header: "Ay" },
          { header: "Tahsilat", money: true },
          { header: "Büro gideri", money: true },
          { header: "Net", money: true },
          { header: "Müvekkil masrafı", money: true },
        ],
        rows: data.monthRows.map(([k, m]) => [
          formatPeriod(k),
          m.income,
          m.office,
          m.income - m.office,
          m.client,
        ]),
      },
      {
        name: "Müvekkiller",
        columns: [
          { header: "Müvekkil" },
          { header: "Tahsil edilen", money: true },
          { header: "Masraf", money: true },
          { header: "Açık alacak", money: true },
        ],
        rows: data.byClient.map((r) => [r.client.name, r.collected, r.exp, r.open]),
      },
      {
        name: "Avukatlar",
        columns: [
          { header: "Kullanıcı" },
          { header: "Açık dosya" },
          { header: "Görev" },
          { header: "Tamamlanan" },
          { header: "Geciken" },
          { header: "Girilen masraf", money: true },
        ],
        rows: data.byLawyer.map((r) => [
          r.user.name,
          r.openCases,
          r.tasks,
          r.done,
          r.late,
          r.expenses,
        ]),
      },
      {
        name: "Yaşlandırma",
        columns: [{ header: "Gecikme" }, { header: "Taksit" }, { header: "Tutar", money: true }],
        rows: data.aging.map((b) => [b.label, b.count, b.amount]),
      },
      {
        name: "Masraf türleri",
        columns: [{ header: "Tür" }, { header: "Tutar", money: true }],
        rows: data.types,
      },
    ]);

  const agingMax = Math.max(...data.aging.map((b) => b.amount), 1);
  const typeMax = Math.max(...data.types.map(([, v]) => v), 1);
  const typeTotal = sumBy(data.types, ([, v]) => v);

  return (
    <PageShell>
      <PageHeader
        title="Raporlar"
        description={`${formatDate(from)} – ${formatDate(to)} dönemi`}
        icon={BarChart3}
        actions={
          <div className="no-print flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Yazdır
            </Button>
            <Button onClick={exportAll}>
              <Download /> Excel (tüm sayfalar)
            </Button>
          </div>
        }
      />
      <div className="no-print flex flex-wrap items-center gap-2">
        <Segmented
          className="w-auto"
          value={custom ? "custom" : preset}
          onChange={(v) => {
            setCustom(null);
            setPreset(v);
          }}
          options={[
            { value: "month", label: "Bu ay" },
            { value: "quarter", label: "Son 3 ay" },
            { value: "year", label: "Bu yıl" },
            { value: "12m", label: "Son 12 ay" },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={from}
            onChange={(e) => setCustom({ from: e.target.value, to })}
            className="h-9 w-auto"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setCustom({ from, to: e.target.value })}
            className="h-9 w-auto"
          />
        </div>
      </div>

      <StatGrid>
        <StatTile
          label="Tahsilat"
          value={formatMoney(data.income)}
          icon={TrendingUp}
          tone="green"
        />
        <StatTile
          label="Büro gideri"
          value={formatMoney(data.officeExp)}
          icon={TrendingDown}
          tone="amber"
        />
        <StatTile
          label="Net"
          value={formatMoney(data.net)}
          icon={PiggyBank}
          tone={data.net >= 0 ? "blue" : "red"}
          hint={data.margin == null ? "—" : `%${Math.round(data.margin * 100)} kâr marjı`}
        />
        <StatTile
          label="Müvekkil masrafları"
          value={formatMoney(data.clientExp)}
          tone="violet"
          hint="Müvekkile yansıtılan (gelir değil)"
        />
      </StatGrid>
      <StatGrid>
        <StatTile
          label="Tahsilat oranı"
          value={data.collectionRate == null ? "—" : `%${Math.round(data.collectionRate * 100)}`}
          icon={Percent}
          tone="blue"
          hint={`Vadesi gelen ${formatMoney(data.dueTotal)} · tahsil ${formatMoney(data.duePaid)}`}
        />
        <StatTile
          label="Nakit yeterliliği"
          value={data.runway == null ? "—" : `${data.runway.toFixed(1)} ay`}
          icon={Hourglass}
          tone={data.runway != null && data.runway < 3 ? "red" : "green"}
          hint={`Kasa+banka ${formatMoney(data.cash)} / ort. aylık gider`}
        />
        <StatTile
          label="Geciken alacak"
          value={formatMoney(sumBy(data.aging, (b) => b.amount))}
          icon={Target}
          tone="red"
          hint={`${sumBy(data.aging, (b) => b.count)} taksit`}
        />
        <StatTile
          label="Aktif müvekkil"
          value={state.clients.filter((c) => c.status === "Aktif").length}
          tone="slate"
        />
      </StatGrid>

      <CashflowChart />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Alacak yaşlandırma" description="Vadesi geçmiş açık taksitler">
          <ul className="space-y-3">
            {data.aging.map((b, i) => (
              <li key={b.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground">
                    <Money value={b.amount} className="font-medium text-foreground" /> · {b.count}{" "}
                    taksit
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "progress-bar h-full rounded-full",
                      ["bg-amber-400", "bg-orange-500", "bg-rose-500", "bg-rose-700"][i],
                    )}
                    style={{ width: `${(b.amount / agingMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Masraf türleri" description={`Dönem toplamı ${formatMoney(typeTotal)}`}>
          <ul className="space-y-3">
            {data.types.slice(0, 8).map(([type, v]) => (
              <li key={type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{type}</span>
                  <span className="text-muted-foreground">
                    <Money value={v} className="font-medium text-foreground" /> · %
                    {Math.round((v / typeTotal) * 100)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="progress-bar h-full rounded-full bg-[var(--series-1)]"
                    style={{ width: `${(v / typeMax) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {data.types.length === 0 && (
              <p className="text-sm text-muted-foreground">Bu dönemde masraf yok.</p>
            )}
          </ul>
        </Section>
      </div>

      <Section
        title="Müvekkil bazında"
        description="Dönemde tahsil edilen ücret, yansıtılan masraf ve açık alacak"
        bodyClassName="p-0"
      >
        <ReportTable
          head={["Müvekkil", "Tahsil edilen", "Masraf", "Açık alacak"]}
          rows={data.byClient.map((r) => [
            <span className="flex items-center gap-2">
              <Avatar name={r.client.name} size="xs" />
              {r.client.name}
            </span>,
            <Money value={r.collected} className="font-medium" />,
            <Money value={r.exp} className="text-muted-foreground" />,
            <Money
              value={r.open}
              className={r.open ? "font-medium text-rose-600" : "text-muted-foreground"}
            />,
          ])}
        />
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Ekip iş yükü" bodyClassName="p-0">
          <ReportTable
            head={["Kullanıcı", "Açık dosya", "Görev", "Geciken", "Masraf"]}
            rows={data.byLawyer.map((r) => [
              <span className="flex items-center gap-2">
                <Avatar name={r.user.name} size="xs" />
                {r.user.name}
              </span>,
              r.openCases,
              `${r.done}/${r.tasks}`,
              <span className={r.late ? "font-semibold text-rose-600" : "text-muted-foreground"}>
                {r.late}
              </span>,
              <Money value={r.expenses} className="text-muted-foreground" />,
            ])}
          />
        </Section>
        <Section title="Aylık döküm" bodyClassName="p-0">
          <ReportTable
            head={["Ay", "Tahsilat", "Büro gideri", "Net"]}
            rows={data.monthRows.map(([k, m]) => [
              formatPeriod(k),
              <Money value={m.income} />,
              <Money value={m.office} className="text-muted-foreground" />,
              <Money value={m.income - m.office} colored className="font-semibold" />,
            ])}
          />
        </Section>
      </div>
    </PageShell>
  );
}

function ReportTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={h}
                className={cn("px-4 py-2.5 font-medium", i === 0 ? "text-left" : "text-right")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-4 py-2.5", j === 0 ? "text-left" : "text-right")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-4 py-8 text-center text-muted-foreground">
                Veri yok
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
