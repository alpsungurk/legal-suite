import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  FolderKanban,
  Gavel,
  Landmark,
  Receipt,
  TrendingUp,
  Wallet,
  AlarmClock,
  PiggyBank,
  ArrowRight,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { accountBalances, allInstallments, clientFinance, feeIncomeInRange } from "@/lib/finance";
import { addDays, formatDateLong, formatMoney, sumBy, today } from "@/lib/format";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { PageShell, Section, Money, ProgressBar } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AgendaWidget,
  AlertsPanel,
  CashflowChart,
  ExpenseBreakdown,
  RecentActivity,
  UpcomingInstallments,
} from "@/components/dashboard/widgets";
import { QuickAddMenu } from "@/components/layout/Topbar";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Gösterge paneli — Lex Yönetim" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

function Dashboard() {
  const { currentUser, permissions } = useErp();
  const firstName = currentUser.name.replace(/^Av\.\s*/, "").split(" ")[0];
  return (
    <PageShell>
      <header className="flex flex-col gap-3 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatDateLong(today())}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-[-0.02em] sm:text-[1.75rem]">
            {greeting()}, {firstName}
          </h1>
        </div>
        <QuickAddMenu
          trigger={
            <Button className="self-start sm:self-auto">
              Hızlı işlem <ArrowRight />
            </Button>
          }
        />
      </header>
      {permissions.viewFinance ? <FinanceDashboard /> : <LawyerDashboard />}
    </PageShell>
  );
}

function FinanceDashboard() {
  const { state } = useErp();
  const t = today();
  const monthStart = `${t.slice(0, 7)}-01`;
  const prevStart = (() => {
    const d = new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const prevEnd = addDays(monthStart, -1);
  const thisMonth = feeIncomeInRange(state, monthStart, t);
  const lastMonth = feeIncomeInRange(state, prevStart, prevEnd);
  const change = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const inst = allInstallments(state).filter((r) => r.status !== "Ödendi");
  const receivable = sumBy(inst, (r) => r.remaining);
  const overdue = sumBy(
    inst.filter((r) => r.status === "Gecikmiş"),
    (r) => r.remaining,
  );
  const cash = sumBy(
    accountBalances(state).filter((b) => b.account.active),
    (b) => b.balance,
  );
  const monthExpense = sumBy(
    state.expenses.filter((e) => e.date >= monthStart),
    (e) => e.amount,
  );

  return (
    <>
      <StatGrid>
        <StatTile
          label="Bu ay tahsilat"
          value={formatMoney(thisMonth)}
          icon={TrendingUp}
          tone="green"
          hint={
            change == null
              ? "Geçen ay tahsilat yok"
              : `${change >= 0 ? "▲" : "▼"} %${Math.abs(change)} geçen aya göre`
          }
          hintTone={change == null ? undefined : change >= 0 ? "green" : "red"}
          to="/tahsilatlar"
        />
        <StatTile
          label="Bekleyen alacak"
          value={formatMoney(receivable)}
          icon={Wallet}
          tone="blue"
          hint={overdue ? `${formatMoney(overdue)} vadesi geçmiş` : "Geciken alacak yok"}
          hintTone={overdue ? "red" : "green"}
          to="/taksitler"
        />
        <StatTile
          label="Kasa + banka"
          value={formatMoney(cash)}
          icon={Landmark}
          tone="violet"
          hint={`${state.accounts.filter((a) => a.active).length} aktif hesap`}
          to="/banka-kasa"
        />
        <StatTile
          label="Bu ay masraf"
          value={formatMoney(monthExpense)}
          icon={Receipt}
          tone="amber"
          hint="Dosya + büro giderleri"
          to="/masraflar"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        <CashflowChart />
        <AlertsPanel />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingInstallments />
        <AgendaWidget />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ExpenseBreakdown />
        <AdvanceWatch />
        <RecentActivity />
      </div>
    </>
  );
}

function AdvanceWatch() {
  const { state } = useErp();
  const rows = state.clients
    .filter((c) => c.status === "Aktif")
    .map((c) => ({ client: c, fin: clientFinance(state, c.id) }))
    .filter((r) => r.fin.advance.received > 0 || r.fin.advance.spent > 0)
    .sort((a, b) => a.fin.advance.balance - b.fin.advance.balance)
    .slice(0, 6);
  return (
    <Section
      title="Masraf avansları"
      description="Bakiyesi en düşük müvekkiller"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/avanslar">
            Tümü <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
    >
      <ul className="space-y-3.5">
        {rows.map(({ client, fin }) => {
          const used = fin.advance.received > 0 ? fin.advance.spent / fin.advance.received : 1;
          return (
            <li key={client.id}>
              <Link to="/muvekkiller/$id" params={{ id: client.id }} className="group block">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium group-hover:text-primary">
                    {client.name}
                  </span>
                  <Money value={fin.advance.balance} colored className="font-semibold" />
                </div>
                <ProgressBar
                  value={used}
                  tone={used >= 1 ? "red" : used > 0.8 ? "amber" : "green"}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatMoney(fin.advance.spent)} / {formatMoney(fin.advance.received)} kullanıldı
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function LawyerDashboard() {
  const { state, currentUser } = useErp();
  const t = today();
  const weekEnd = addDays(t, 7);
  const myCases = state.cases.filter(
    (c) => c.responsibleIds.includes(currentUser.id) && c.status !== "Kapalı",
  );
  const myEvents = state.reminders.filter(
    (r) => r.assigneeId === currentUser.id && r.status === "Bekliyor",
  );
  const hearings = myEvents.filter(
    (r) => r.type === "Duruşma" && r.date >= t && r.date <= weekEnd,
  ).length;
  const late = myEvents.filter((r) => r.date < t).length;
  const myEnf = state.enforcements.filter(
    (e) => e.responsibleIds.includes(currentUser.id) && e.status !== "Kapandı",
  );
  const monthStart = `${t.slice(0, 7)}-01`;
  const myExpenses = state.expenses.filter(
    (e) => e.createdBy === currentUser.id && e.date >= monthStart,
  );

  return (
    <>
      <StatGrid>
        <StatTile
          label="Aktif dosyalarım"
          value={myCases.length}
          icon={FolderKanban}
          tone="blue"
          hint={`${myEnf.length} icra dosyası`}
          to="/dosyalar"
        />
        <StatTile
          label="Bu hafta duruşma"
          value={hearings}
          icon={Gavel}
          tone="violet"
          hint="7 gün içinde"
          to="/takvim"
        />
        <StatTile
          label="Geciken işler"
          value={late}
          icon={AlarmClock}
          tone={late ? "red" : "green"}
          hint={late ? "Tarihi geçmiş görev" : "Gecikme yok"}
          hintTone={late ? "red" : "green"}
          to="/takvim"
        />
        <StatTile
          label="Bu ay girdiğim masraf"
          value={formatMoney(sumBy(myExpenses, (e) => e.amount))}
          icon={PiggyBank}
          tone="amber"
          hint={`${myExpenses.length} kayıt`}
          to="/masraflar"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        <AgendaWidget mineOnly />
        <AlertsPanel />
      </div>

      <Section
        title="Dosyalarım"
        description="Sorumlu olduğunuz açık dosyalar"
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dosyalar">
              Tümü <ArrowRight />
            </Link>
          </Button>
        }
        bodyClassName="p-3"
      >
        <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myCases.map((c) => {
            const client = state.clients.find((x) => x.id === c.clientId);
            const next = state.reminders
              .filter((r) => r.caseId === c.id && r.status === "Bekliyor" && r.date >= t)
              .sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <Link
                key={c.id}
                to="/dosyalar/$id"
                params={{ id: c.id }}
                className="interactive-card rounded-xl border border-border/80 bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{c.no}</p>
                    <p className="truncate font-semibold">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{client?.name}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {next ? (
                    <span className="truncate">
                      {next.type} · {formatDateLong(next.date)}
                    </span>
                  ) : (
                    "Yaklaşan kayıt yok"
                  )}
                </div>
              </Link>
            );
          })}
          {myCases.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Size atanmış açık dosya yok.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
