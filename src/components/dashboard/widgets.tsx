import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FileWarning,
  Gavel,
  Info,
  MessageSquare,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { allInstallments, computeAlerts, monthlySeries, type Alert } from "@/lib/finance";
import {
  addDays,
  formatMoney,
  formatMoneyCompact,
  MONTHS_SHORT,
  parseISODate,
  relativeDue,
  sumBy,
  timeAgo,
  today,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Section, Money, Avatar } from "@/components/app/bits";
import { Segmented } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";

/* ───────────── Nakit akışı ───────────── */

export function CashflowChart() {
  const { state } = useErp();
  const [range, setRange] = useState("6");
  const data = useMemo(
    () =>
      monthlySeries(state, Number(range)).map((r) => ({
        ...r,
        label: MONTHS_SHORT[Number(r.key.slice(5, 7)) - 1],
      })),
    [state, range],
  );
  const income = sumBy(data, (d) => d.income);
  const expense = sumBy(data, (d) => d.officeExpense);

  return (
    <Section
      title="Gelir ve büro giderleri"
      description="Tahsil edilen ücretler ile büro giderlerinin aylık karşılaştırması"
      actions={
        <Segmented
          size="sm"
          className="w-auto"
          value={range}
          onChange={setRange}
          options={[
            { value: "6", label: "6 ay" },
            { value: "12", label: "12 ay" },
          ]}
        />
      }
      className="h-full"
    >
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2">
        <Legend color="var(--series-1)" label="Tahsilat" value={income} />
        <Legend color="var(--series-2)" label="Büro gideri" value={expense} />
        <div>
          <p className="text-xs text-muted-foreground">Net</p>
          <Money value={income - expense} colored className="text-lg font-bold" />
        </div>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="28%"
            margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => formatMoneyCompact(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--secondary)", opacity: 0.6 }}
              content={<CashTooltip />}
            />
            <Bar
              dataKey="income"
              name="Tahsilat"
              fill="var(--series-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              animationDuration={700}
            />
            <Bar
              dataKey="officeExpense"
              name="Büro gideri"
              fill="var(--series-2)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </p>
      <Money value={value} className="text-lg font-bold" />
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof monthlySeries>[number] & { label: string } }>;
};

function CashTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const [y, m] = d.key.split("-");
  return (
    <div className="min-w-[200px] rounded-xl border border-border/80 bg-popover p-3 text-xs shadow-elevated">
      <p className="mb-2 font-semibold">
        {MONTHS_SHORT[Number(m) - 1]} {y}
      </p>
      <Row color="var(--series-1)" label="Tahsilat" value={d.income} />
      <Row color="var(--series-2)" label="Büro gideri" value={d.officeExpense} />
      <div className="my-2 border-t border-border/60" />
      <Row label="Net" value={d.net} bold />
      <Row label="Müvekkil masrafı" value={d.clientExpense} muted />
      <Row label="Alınan avans" value={d.advances} muted />
    </div>
  );
}

function Row({
  color,
  label,
  value,
  bold,
  muted,
}: {
  color?: string;
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-0.5",
        muted && "text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-1.5">
        {color && <span className="h-2 w-2 rounded-sm" style={{ background: color }} />}
        {label}
      </span>
      <span className={cn("money", bold && "font-semibold")}>{formatMoney(value)}</span>
    </div>
  );
}

/* ───────────── Dikkat gerektirenler ───────────── */

const alertIcon: Record<Alert["category"], LucideIcon> = {
  Taksit: Wallet,
  "Ödeme sözü": Gavel,
  Ajanda: Clock,
  Avans: AlertTriangle,
  Belge: FileWarning,
  Mesaj: MessageSquare,
};

const toneStyle: Record<Alert["tone"], string> = {
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function AlertsPanel({ limit = 7 }: { limit?: number }) {
  const { state, currentUser, permissions } = useErp();
  const navigate = useNavigate();
  const alerts = useMemo(
    () => computeAlerts(state, currentUser, permissions.viewFinance),
    [state, currentUser, permissions.viewFinance],
  );
  const urgent = alerts.filter((a) => a.tone === "danger").length;
  return (
    <Section
      title="Dikkat gerektirenler"
      description={alerts.length ? `${alerts.length} konu · ${urgent} acil` : "Her şey yolunda"}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/bildirimler">
            Tümü <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
      bodyClassName="p-2"
    >
      {alerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Bekleyen uyarı yok"
          description="Geciken ödeme, yaklaşan süre ya da okunmamış mesaj bulunmuyor."
          compact
        />
      ) : (
        <ul className="stagger">
          {alerts.slice(0, limit).map((a) => {
            const Icon = alertIcon[a.category] ?? Info;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: a.link })}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      toneStyle[a.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-medium",
                      a.tone === "danger"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {relativeDue(a.date)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ───────────── Yaklaşan taksitler ───────────── */

export function UpcomingInstallments() {
  const { state } = useErp();
  const quick = useQuick();
  const horizon = addDays(today(), 14);
  const rows = allInstallments(state)
    .filter((r) => r.status !== "Ödendi" && r.inst.dueDate <= horizon)
    .slice(0, 7);
  const total = sumBy(rows, (r) => r.remaining);
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  return (
    <Section
      title="Tahsil edilecekler"
      description={`Geciken ve 14 gün içinde vadesi gelen · ${formatMoney(total)}`}
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/taksitler">
            Tümü <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
      bodyClassName="p-2"
    >
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Yaklaşan vade yok" compact />
      ) : (
        <ul className="stagger">
          {rows.map((r) => (
            <li
              key={r.inst.id}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60"
            >
              <DateChip date={r.inst.dueDate} danger={r.status === "Gecikmiş"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{clientName(r.plan.clientId)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.plan.title} · {r.index + 1}/{r.plan.installments.length}
                </p>
              </div>
              <div className="text-right">
                <Money value={r.remaining} className="text-sm font-semibold" />
                <p
                  className={cn(
                    "text-[11px]",
                    r.status === "Gecikmiş"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground",
                  )}
                >
                  {relativeDue(r.inst.dueDate)}
                </p>
              </div>
              <Button
                size="sm"
                variant="soft"
                className="hidden opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex"
                onClick={() => quick.open("payment", { plan: r.plan, installmentId: r.inst.id })}
              >
                Tahsil et
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function DateChip({ date, danger }: { date: string; danger?: boolean }) {
  const d = parseISODate(date);
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl leading-none",
        danger ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-primary/8 text-primary",
      )}
    >
      <span className="flex flex-col items-center">
        <span className="text-[9px] font-semibold uppercase tracking-wider">
          {MONTHS_SHORT[d.getMonth()]}
        </span>
        <span className="text-base font-bold">{d.getDate()}</span>
      </span>
    </span>
  );
}

/* ───────────── Ajanda ───────────── */

export function AgendaWidget({ mineOnly }: { mineOnly?: boolean }) {
  const { state, currentUser } = useErp();
  const quick = useQuick();
  const t = today();
  const horizon = addDays(t, 7);
  const items = state.reminders
    .filter(
      (r) =>
        r.status === "Bekliyor" &&
        r.date <= horizon &&
        (!mineOnly || r.assigneeId === currentUser.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 7);
  const caseOf = (id?: string) => state.cases.find((c) => c.id === id);
  const userOf = (id: string) => state.users.find((u) => u.id === id);
  return (
    <Section
      title={mineOnly ? "Ajandam" : "Bu hafta"}
      description="Duruşmalar, süreler ve görevler"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/takvim">
            Takvim <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
      bodyClassName="p-2"
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="Bu hafta için kayıt yok"
          compact
          action={
            <Button size="sm" variant="outline" onClick={() => quick.open("reminder")}>
              Ajandaya ekle
            </Button>
          }
        />
      ) : (
        <ul className="stagger">
          {items.map((r) => {
            const c = caseOf(r.caseId);
            const u = userOf(r.assigneeId);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => quick.open("reminder", { record: r })}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <DateChip date={r.date} danger={r.date < t} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <StatusBadge
                        status={r.type}
                        className="hidden h-5 px-2 text-[10px] sm:inline-flex"
                      />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.time, c ? `${c.no} · ${c.title}` : null, r.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {!mineOnly && u && <Avatar name={u.name} size="xs" />}
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-medium",
                      r.date < t
                        ? "text-rose-600"
                        : r.date === t
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {relativeDue(r.date)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ───────────── Masraf dağılımı (sıralı yatay çubuk) ───────────── */

export function ExpenseBreakdown() {
  const { state } = useErp();
  const from = addDays(today(), -90);
  const byType = new Map<string, number>();
  for (const e of state.expenses.filter((e) => e.date >= from))
    byType.set(e.type, (byType.get(e.type) ?? 0) + e.amount);
  const rows = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const top = rows.slice(0, 6);
  const other = rows.slice(6).reduce((s, [, v]) => s + v, 0);
  if (other) top.push(["Diğer türler", other]);
  const max = Math.max(...top.map(([, v]) => v), 1);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return (
    <Section
      title="Masraf dağılımı"
      description={`Son 90 gün · ${formatMoney(total)}`}
      className="h-full"
    >
      {top.length === 0 ? (
        <EmptyState icon={Wallet} title="Masraf yok" compact />
      ) : (
        <ul className="space-y-3">
          {top.map(([type, value]) => (
            <li key={type} className="group">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{type}</span>
                <span className="text-muted-foreground">
                  <Money value={value} className="font-medium text-foreground" /> · %
                  {Math.round((value / total) * 100)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="progress-bar h-full rounded-full bg-[var(--series-1)] transition-opacity group-hover:opacity-80"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ───────────── Son hareketler ───────────── */

export function RecentActivity({ limit = 6 }: { limit?: number }) {
  const { state } = useErp();
  const items = state.activities.slice(0, limit);
  const actor = (id: string) => state.users.find((u) => u.id === id)?.name ?? "Sistem";
  return (
    <Section
      title="Son hareketler"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/aktivite">
            Tümü <ArrowRight />
          </Link>
        </Button>
      }
      className="h-full"
    >
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="Henüz hareket yok" compact />
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
          {items.map((a) => (
            <li key={a.id} className="relative flex gap-3 animate-fade-up">
              <Avatar name={actor(a.actorId)} size="sm" className="relative ring-4 ring-card" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{actor(a.actorId)}</span>{" "}
                  <span className="text-muted-foreground">
                    {a.entity.toLocaleLowerCase("tr")}{" "}
                    {a.action === "Ekleme"
                      ? "ekledi"
                      : a.action === "Güncelleme"
                        ? "güncelledi"
                        : a.action === "Silme"
                          ? "sildi"
                          : "işlemi yaptı"}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {timeAgo(a.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
