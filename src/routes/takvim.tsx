import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { allInstallments } from "@/lib/finance";
import {
  addDays,
  formatDateLong,
  formatMoney,
  MONTHS_LONG,
  pad,
  parseISODate,
  today,
  WEEKDAYS_SHORT,
} from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell, Section } from "@/components/app/bits";
import { Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";
import { ReminderTable } from "@/components/lists/tables";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/lib/erp-types";

export const Route = createFileRoute("/takvim")({
  head: () => ({ meta: [{ title: "Ajanda — Lex Yönetim" }] }),
  component: Page,
});

type Ev = {
  id: string;
  date: string;
  time?: string;
  title: string;
  sub?: string;
  kind: "Duruşma" | "Süre" | "Görev" | "Taksit" | "Ödeme sözü";
  done?: boolean;
  reminder?: Reminder;
  planId?: string;
  enforcementId?: string;
};

const kindStyle: Record<Ev["kind"], string> = {
  Duruşma: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-l-violet-500",
  Süre: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-l-rose-500",
  Görev: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-l-blue-500",
  Taksit: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-l-emerald-500",
  "Ödeme sözü": "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-l-amber-500",
};
const kindDot: Record<Ev["kind"], string> = {
  Duruşma: "bg-violet-500",
  Süre: "bg-rose-500",
  Görev: "bg-blue-500",
  Taksit: "bg-emerald-500",
  "Ödeme sözü": "bg-amber-500",
};

function Page() {
  const { state, currentUser, permissions, patch } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  const t = today();
  const [cursor, setCursor] = useState(() => t.slice(0, 7));
  const [selected, setSelected] = useState(t);
  const [scope, setScope] = useState(permissions.viewFinance ? "all" : "mine");
  const [view, setView] = useState("month");
  const [planId, setPlanId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const events = useMemo(() => {
    const out: Ev[] = [];
    const caseNo = (id?: string) => state.cases.find((c) => c.id === id)?.no;
    for (const r of state.reminders) {
      if (r.status === "İptal") continue;
      if (scope === "mine" && r.assigneeId !== currentUser.id) continue;
      out.push({
        id: r.id,
        date: r.date,
        time: r.time,
        title: r.title,
        sub: [caseNo(r.caseId), r.location].filter(Boolean).join(" · "),
        kind:
          r.type === "Duruşma" || r.type === "Keşif"
            ? "Duruşma"
            : r.type === "Süre sonu"
              ? "Süre"
              : "Görev",
        done: r.status === "Tamamlandı",
        reminder: r,
      });
    }
    if (permissions.viewFinance && scope === "all") {
      for (const row of allInstallments(state)) {
        if (row.status === "Ödendi") continue;
        out.push({
          id: row.inst.id,
          date: row.inst.dueDate,
          title: `${state.clients.find((c) => c.id === row.plan.clientId)?.name ?? ""} · ${formatMoney(row.remaining)}`,
          sub: row.plan.title,
          kind: "Taksit",
          planId: row.plan.id,
        });
      }
    }
    for (const p of state.promises) {
      if (p.status !== "Bekliyor") continue;
      const ef = state.enforcements.find((e) => e.id === p.enforcementId);
      if (scope === "mine" && !ef?.responsibleIds.includes(currentUser.id)) continue;
      out.push({
        id: p.id,
        date: p.dueDate,
        title: `${state.debtors.find((d) => d.id === p.debtorId)?.name ?? "Borçlu"} · ${formatMoney(p.amount)}`,
        sub: ef?.no,
        kind: "Ödeme sözü",
        enforcementId: p.enforcementId,
      });
    }
    return out.sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99"),
    );
  }, [state, scope, currentUser.id, permissions.viewFinance]);

  const byDate = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  // Ay ızgarası (Pazartesi başlangıçlı)
  const first = parseISODate(`${cursor}-01`);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = addDays(`${cursor}-01`, -offset);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = days[35].slice(0, 7) !== cursor ? 5 : 6;

  const shiftMonth = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1);
    setCursor(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const open = (e: Ev) => {
    if (e.reminder) quick.open("reminder", { record: e.reminder });
    else if (e.planId) setPlanId(e.planId);
    else if (e.enforcementId) navigate({ to: "/icra/$id", params: { id: e.enforcementId } });
  };

  const selectedEvents = byDate.get(selected) ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Ajanda"
        description="Duruşmalar, süreler, görevler, taksit vadeleri ve ödeme sözleri"
        icon={CalendarDays}
        actions={
          <Button onClick={() => quick.open("reminder", { preset: { date: selected } })}>
            <Plus /> Yeni kayıt
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          className="w-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Takvim" },
            { value: "list", label: "Liste" },
          ]}
        />
        <Segmented
          className="w-auto"
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "Benim" },
            { value: "all", label: "Tüm büro" },
          ]}
        />
        <div className="ml-auto hidden flex-wrap items-center gap-3 text-xs text-muted-foreground lg:flex">
          {(Object.keys(kindDot) as Ev["kind"][]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", kindDot[k])} /> {k}
            </span>
          ))}
        </div>
      </div>

      {view === "list" ? (
        <ReminderTable
          rows={state.reminders.filter((r) => scope === "all" || r.assigneeId === currentUser.id)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft animate-fade-up">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {MONTHS_LONG[first.getMonth()]} {first.getFullYear()}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCursor(t.slice(0, 7));
                    setSelected(t);
                  }}
                >
                  Bugün
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Önceki ay"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => shiftMonth(1)}
                  aria-label="Sonraki ay"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
              {WEEKDAYS_SHORT.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              className="grid grid-cols-7"
              style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
            >
              {days.slice(0, weeks * 7).map((d) => {
                const evs = byDate.get(d) ?? [];
                const inMonth = d.slice(0, 7) === cursor;
                const isToday = d === t;
                const isSel = d === selected;
                const weekend = [5, 6].includes((parseISODate(d).getDay() + 6) % 7);
                return (
                  <div
                    key={d}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(d)}
                    onDoubleClick={() => quick.open("reminder", { preset: { date: d } })}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(d)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(d);
                    }}
                    onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const id = e.dataTransfer.getData("text/reminder");
                      if (id) {
                        patch("reminders", id, { date: d });
                        toast.success(`Kayıt ${formatDateLong(d)} tarihine taşındı`);
                      }
                    }}
                    className={cn(
                      "group relative min-h-[92px] cursor-pointer border-b border-r border-border/50 p-1.5 text-left transition-colors sm:min-h-[112px]",
                      !inMonth && "bg-muted/25",
                      weekend && inMonth && "bg-muted/10",
                      isSel && "bg-primary/[0.05] ring-2 ring-inset ring-primary/40",
                      dragOver === d && "bg-primary/10",
                      "hover:bg-secondary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-medium",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {parseISODate(d).getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {evs.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          draggable={!!e.reminder}
                          onDragStart={(ev) =>
                            e.reminder && ev.dataTransfer.setData("text/reminder", e.reminder.id)
                          }
                          onClick={(ev) => {
                            ev.stopPropagation();
                            open(e);
                          }}
                          className={cn(
                            "hidden truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] font-medium transition-transform hover:translate-x-0.5 sm:block",
                            kindStyle[e.kind],
                            e.done && "opacity-50 line-through",
                            e.reminder && "cursor-grab active:cursor-grabbing",
                          )}
                          title={`${e.title}${e.sub ? ` · ${e.sub}` : ""}`}
                        >
                          {e.time && <span className="mr-1 opacity-70">{e.time}</span>}
                          {e.title}
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <p className="hidden px-1 text-[10px] font-medium text-muted-foreground sm:block">
                          +{evs.length - 3} daha
                        </p>
                      )}
                      <div className="flex flex-wrap gap-0.5 sm:hidden">
                        {evs.slice(0, 4).map((e) => (
                          <span
                            key={e.id}
                            className={cn("h-1.5 w-1.5 rounded-full", kindDot[e.kind])}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Section
            title={formatDateLong(selected)}
            description={`${selected === t ? "Bugün · " : ""}${selectedEvents.length} kayıt`}
            actions={
              <Button
                size="sm"
                variant="soft"
                onClick={() => quick.open("reminder", { preset: { date: selected } })}
              >
                <Plus /> Ekle
              </Button>
            }
            bodyClassName="p-2"
            className="h-fit xl:sticky xl:top-20"
          >
            {selectedEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Bu gün için kayıt yok"
                description="Takvimde bir güne çift tıklayarak hızlıca kayıt ekleyebilirsiniz."
                compact
              />
            ) : (
              <ul className="stagger space-y-1.5">
                {selectedEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => open(e)}
                      className={cn(
                        "w-full rounded-xl border-l-[3px] px-3 py-2.5 text-left transition-transform hover:translate-x-0.5",
                        kindStyle[e.kind],
                        e.done && "opacity-60",
                      )}
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {e.time && <span className="text-xs opacity-75">{e.time}</span>}
                        <span className={cn("truncate", e.done && "line-through")}>{e.title}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs opacity-80">
                        {e.kind}
                        {e.sub && ` · ${e.sub}`}
                      </p>
                    </button>
                    {e.reminder && !e.done && (
                      <button
                        type="button"
                        onClick={() => {
                          patch("reminders", e.reminder!.id, { status: "Tamamlandı" });
                          toast.success("Tamamlandı olarak işaretlendi");
                        }}
                        className="ml-3 mt-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
                      >
                        ✓ Tamamlandı işaretle
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}
