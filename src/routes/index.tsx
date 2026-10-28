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
  Lock,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { isEnforcementInactive } from "@/lib/erp-types";
import {
  accountBalances,
  allInstallments,
  clientFinance,
  expenseNetCost,
  feeIncomeInRange,
} from "@/lib/finance";
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
  UpcomingInstallments,
} from "@/components/dashboard/widgets";
import { QuickAddMenu } from "@/components/layout/Topbar";
import { ContentLoader } from "@/components/app/Loader";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Gösterge paneli — Avukat Yönetim Paneli" }] }),
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
  const { currentUser, permissions, hydrated } = useErp();
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
      {!hydrated ? (
        <ContentLoader />
      ) : permissions.can("fees") || permissions.can("accounts") || permissions.can("ledger") ? (
        <FinanceDashboard />
      ) : (
        <LawyerDashboard />
      )}
    </PageShell>
  );
}

function FinanceDashboard() {
  const { state: fullState, permissions: perm } = useErp();
  // Genel ücret rakamlarına Vekalet (yalnızca yöneticiye özel) planları girmez; ayrı bölümde gösterilir
  const state = { ...fullState, plans: fullState.plans.filter((p) => !p.adminOnly) };
  const seeFees = perm.can("fees");
  const seeAccounts = perm.can("accounts");
  const seeExpenses = perm.can("expenses");
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
  // Müvekkilin geri ödediği masraf büroya maliyet değildir
  const monthExpense = sumBy(
    state.expenses.filter((e) => e.date >= monthStart),
    expenseNetCost,
  );

  return (
    <>
      <StatGrid>
        {seeFees && (
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
        )}
        {seeFees && (
          <StatTile
            label="Bekleyen alacak"
            value={formatMoney(receivable)}
            icon={Wallet}
            tone="blue"
            hint={overdue ? `${formatMoney(overdue)} vadesi geçmiş` : "Geciken alacak yok"}
            hintTone={overdue ? "red" : "green"}
            to="/tahsilatlar"
          />
        )}
        {seeAccounts && (
          <StatTile
            label="Kasa + banka"
            value={formatMoney(cash)}
            icon={Landmark}
            tone="violet"
            hint={`${state.accounts.filter((a) => a.active).length} aktif hesap`}
            to="/banka-kasa"
          />
        )}
        {seeExpenses && (
          <StatTile
            label="Bu ay masraf"
            value={formatMoney(monthExpense)}
            icon={Receipt}
            tone="amber"
            hint="Dosya + büro giderleri"
            to="/masraflar"
          />
        )}
      </StatGrid>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        {seeFees && seeAccounts ? <CashflowChart /> : null}
        <AlertsPanel />
      </div>

      {perm.isAdmin && <VekaletSection />}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {seeFees && <UpcomingInstallments />}
        <AgendaWidget mineOnly={!perm.can("reminders")} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {seeExpenses && <ExpenseBreakdown />}
        {perm.can("ledger") && <ClientBalances />}
      </div>
    </>
  );
}

/** Yalnızca yöneticinin gördüğü vekalet ücretleri: özet kartları ve yaklaşan taksitler */
function VekaletSection() {
  const { state: fullState } = useErp();
  const state = { ...fullState, plans: fullState.plans.filter((p) => p.adminOnly) };
  const t = today();
  const inst = allInstallments(state).filter((r) => r.status !== "Ödendi");
  const overdue = inst.filter((r) => r.status === "Gecikmiş");
  return (
    <Section
      title="Vekalet ücretleri"
      description="Yalnızca yönetici görür; avukatların panelinde ve rakamlarında yer almaz"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/vekalet">
            Vekalet ücretleri <ArrowRight />
          </Link>
        </Button>
      }
      bodyClassName="space-y-3 p-3"
    >
      <StatGrid>
        <StatTile
          label="Bu ay tahsil edilen"
          value={formatMoney(feeIncomeInRange(state, `${t.slice(0, 7)}-01`, t))}
          icon={Lock}
          tone="green"
          hint="Vekalet ücreti"
          to="/vekalet"
        />
        <StatTile
          label="Bekleyen vekalet"
          value={formatMoney(sumBy(inst, (r) => r.remaining))}
          icon={Wallet}
          tone="blue"
          hint={`${inst.length} taksit · ${state.plans.length} plan`}
          to="/vekalet"
        />
        <StatTile
          label="Vadesi geçmiş"
          value={formatMoney(sumBy(overdue, (r) => r.remaining))}
          icon={AlarmClock}
          tone="red"
          hint={`${overdue.length} taksit`}
          hintTone={overdue.length ? "red" : undefined}
          to="/vekalet"
        />
      </StatGrid>
      <UpcomingInstallments adminOnly />
    </Section>
  );
}

/** Büroya en çok borcu olan müvekkiller */
function ClientBalances() {
  const { state } = useErp();
  const rows = state.clients
    .map((c) => ({ client: c, fin: clientFinance(state, c.id) }))
    .filter((r) => r.fin.balance > 0.005)
    .sort((a, b) => b.fin.balance - a.fin.balance)
    .slice(0, 6);
  const max = rows[0]?.fin.balance ?? 0;
  return (
    <Section
      title="Cari bakiyeler"
      description="Büroya borcu en yüksek müvekkiller"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/cari-hesap">
            Tümü <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Borçlu müvekkil yok.</p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map(({ client, fin }) => (
            <li key={client.id}>
              <Link to="/muvekkiller/$id" params={{ id: client.id }} className="group block">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium group-hover:text-primary">
                    {client.name}
                  </span>
                  <Money value={fin.balance} className="font-semibold" />
                </div>
                <ProgressBar value={max ? fin.balance / max : 0} tone="amber" />
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {formatMoney(fin.expenseCharged)} masraf · {formatMoney(fin.feeRemaining)} ücret
                  alacağı
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function LawyerDashboard() {
  const { state, currentUser, permissions } = useErp();
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
    (e) => e.responsibleIds.includes(currentUser.id) && !isEnforcementInactive(e.status),
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
        <AgendaWidget mineOnly />
        <AlertsPanel />
      </div>

      {permissions.can("cases") && (
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
                  className="rounded-xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:bg-secondary/40"
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
      )}
    </>
  );
}
