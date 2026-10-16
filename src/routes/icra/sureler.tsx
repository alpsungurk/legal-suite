import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  Hourglass,
  RotateCcw,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { DEADLINE_TITLES, icraDeadlines, type DeadlineKind, type IcraDeadline } from "@/lib/finance";
import { addDays, formatDate, relativeDue, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Segmented } from "@/components/app/fields";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { doneData } from "@/components/icra/event-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/icra/sureler")({
  head: () => ({ meta: [{ title: "İcra süreleri — Avukat Yönetim Paneli" }] }),
  component: Page,
});

type Phase = "Gecikmiş" | "Bugün" | "Bu hafta" | "Yaklaşan" | "Tamamlandı";
const PHASE_TONE: Record<Phase, "red" | "amber" | "blue" | "slate" | "green"> = {
  Gecikmiş: "red",
  Bugün: "amber",
  "Bu hafta": "blue",
  Yaklaşan: "slate",
  Tamamlandı: "green",
};
const PHASE_RANK: Record<Phase, number> = {
  Gecikmiş: 0,
  Bugün: 1,
  "Bu hafta": 2,
  Yaklaşan: 3,
  Tamamlandı: 4,
};

type Row = IcraDeadline & {
  phase: Phase;
  no: string;
  office: string;
  client: string;
  debtor: string;
  procedure: string;
  responsible: string;
  mine: boolean;
  trigger?: string;
};

const KIND_ICON: Partial<Record<DeadlineKind, LucideIcon>> = {
  "Haciz yenileme": Hourglass,
  "Taksit / ödeme sözü": AlarmClock,
};

/**
 * Avukatın talimatındaki bütün süreler tek yerde: takip şekline göre kesinleştirme / tahliye,
 * 89/1'den sonra 89/2, maaş haczinden sonra işveren borçlu ekleme, haciz yenileme ve taksit günleri.
 * Her sabah aynı kurallarla sorumlu avukata bildirim de gider.
 */
function Page() {
  const { state, permissions, patch, currentUser } = useErp();
  const navigate = useNavigate();
  const [view, setView] = useState<"open" | "all">("open");
  const t = today();
  const week = addDays(t, 7);

  const rows = useMemo<Row[]>(() => {
    const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "";
    return icraDeadlines(state).map((d) => {
      const e = state.enforcements.find((x) => x.id === d.enforcementId)!;
      const ev = d.eventId ? state.events.find((x) => x.id === d.eventId) : undefined;
      const phase: Phase = d.resolved
        ? "Tamamlandı"
        : d.dueDate < t
          ? "Gecikmiş"
          : d.dueDate === t
            ? "Bugün"
            : d.dueDate <= week
              ? "Bu hafta"
              : "Yaklaşan";
      const debtorIds = d.debtorId ? [d.debtorId] : e.debtorIds;
      return {
        ...d,
        phase,
        no: e.no,
        office: e.office,
        client: state.clients.find((c) => c.id === e.clientId)?.name ?? "",
        debtor: state.debtors
          .filter((x) => debtorIds.includes(x.id))
          .map((x) => x.name)
          .join(", "),
        procedure: e.procedure ?? "",
        responsible: e.responsibleIds.map(userName).filter(Boolean).join(", "),
        mine: e.responsibleIds.includes(currentUser.id),
        trigger: ev ? `${ev.type} · ${formatDate(ev.date)}` : undefined,
      };
    });
  }, [state, t, week, currentUser.id]);

  if (!permissions.can("enforcements")) return <NoAccess />;

  const visible = view === "open" ? rows.filter((r) => !r.resolved) : rows;
  const count = (p: Phase) => rows.filter((r) => r.phase === p).length;
  const canEdit = permissions.can("enforcements", "edit") || permissions.can("enforcements", "create");

  const setDone = (r: Row, done: boolean) => {
    const ev = state.events.find((x) => x.id === r.eventId);
    if (!ev) return;
    patch("events", ev.id, { data: doneData(ev, done) });
    toast.success(done ? "Süre tamamlandı olarak işaretlendi" : "Süre yeniden açıldı");
  };

  const columns: Column<Row>[] = [
    {
      id: "phase",
      header: "Durum",
      sort: (r) => PHASE_RANK[r.phase],
      export: (r) => r.phase,
      cell: (r) => (
        <StatusBadge tone={PHASE_TONE[r.phase]} className="h-6">
          {r.phase}
        </StatusBadge>
      ),
    },
    {
      id: "kind",
      header: "Yapılacak",
      sort: (r) => r.kind,
      export: (r) => DEADLINE_TITLES[r.kind],
      cell: (r) => {
        const Icon = KIND_ICON[r.kind] ?? Timer;
        return (
          <div className="flex min-w-0 max-w-[420px] items-center gap-3">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                r.phase === "Gecikmiş"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : r.phase === "Tamamlandı"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{DEADLINE_TITLES[r.kind]}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.trigger ?? (r.kind === "Haciz yenileme" ? `Son haciz ${formatDate(r.baseDate)}` : r.kind)}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "file",
      header: "Dosya",
      sort: (r) => r.no,
      export: (r) => `${r.no} · ${r.office}`,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{r.no}</p>
          <p className="truncate text-xs text-muted-foreground">{r.office}</p>
        </div>
      ),
    },
    {
      id: "parties",
      header: "Alacaklı / Borçlu",
      hideBelow: "lg",
      sort: (r) => r.client,
      export: (r) => `${r.client} / ${r.debtor}`,
      cell: (r) => (
        <div className="min-w-0 max-w-[260px]">
          <p className="truncate text-sm">{r.client}</p>
          <p className="truncate text-xs text-muted-foreground">{r.debtor || "—"}</p>
        </div>
      ),
    },
    {
      id: "procedure",
      header: "Takip şekli",
      hideBelow: "xl",
      sort: (r) => r.procedure,
      export: (r) => r.procedure,
      cell: (r) => <span className="text-sm text-muted-foreground">{r.procedure || "—"}</span>,
    },
    {
      id: "responsible",
      header: "Sorumlu",
      hideBelow: "xl",
      sort: (r) => r.responsible,
      export: (r) => r.responsible,
      cell: (r) => <span className="text-sm">{r.responsible || "—"}</span>,
    },
    {
      id: "due",
      header: "Tarih",
      align: "right",
      sort: (r) => r.dueDate,
      export: (r) => formatDate(r.dueDate),
      cell: (r) => (
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-medium",
              r.phase === "Gecikmiş" && "text-rose-600 dark:text-rose-400",
            )}
          >
            {r.resolved ? "—" : relativeDue(r.dueDate)}
          </p>
          <p className="text-[12px] text-muted-foreground">{formatDate(r.dueDate)}</p>
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="İcra süreleri"
        description="Takip şekline göre kesinleştirme ve tahliye, 89/2, işveren borçlu ekleme, haciz yenileme ve taksit günleri. İlgili işlem girilince ya da 'Tamamlandı' denince listeden düşer."
        icon={Timer}
      />

      <StatGrid className="lg:grid-cols-4">
        <StatTile
          label="Gecikmiş"
          value={count("Gecikmiş")}
          icon={AlarmClock}
          tone={count("Gecikmiş") ? "red" : "green"}
          hint={count("Gecikmiş") ? "Süresi geçti" : "Geciken yok"}
          hintTone={count("Gecikmiş") ? "red" : "green"}
        />
        <StatTile
          label="Bugün"
          value={count("Bugün")}
          icon={Timer}
          tone={count("Bugün") ? "amber" : "green"}
          hint="Bugün yapılması gerekenler"
        />
        <StatTile label="Bu hafta" value={count("Bu hafta")} icon={Hourglass} tone="blue" hint="7 gün içinde" />
        <StatTile
          label="Tamamlanan"
          value={count("Tamamlandı")}
          icon={CheckCircle2}
          tone="green"
          hint={`${count("Yaklaşan")} süre daha ileride`}
        />
      </StatGrid>

      <DataTable
        rows={visible}
        columns={columns}
        getId={(r) => r.id}
        searchText={(r) => [r.no, r.office, r.client, r.debtor, r.kind, r.procedure, r.responsible]}
        searchPlaceholder="Dosya no, müvekkil, borçlu..."
        toolbar={
          <Segmented
            size="sm"
            className="w-auto"
            value={view}
            onChange={(v) => setView(v as "open" | "all")}
            options={[
              { value: "open", label: "Bekleyen" },
              { value: "all", label: "Tümü" },
            ]}
          />
        }
        filters={[
          {
            id: "phase",
            label: "Durum",
            options: (Object.keys(PHASE_RANK) as Phase[]).filter((p) => visible.some((r) => r.phase === p)),
            get: (r) => r.phase,
          },
          {
            id: "kind",
            label: "Süre türü",
            options: [...new Set(visible.map((r) => r.kind))],
            get: (r) => r.kind,
          },
          {
            id: "mine",
            label: "Sorumlu",
            options: ["Benim dosyalarım", "Diğerleri"],
            get: (r) => (r.mine ? "Benim dosyalarım" : "Diğerleri"),
          },
        ]}
        dateRange={{ label: "Tarih", get: (r) => r.dueDate }}
        initialSort={{ id: "due" }}
        pageSize={30}
        exportName="İcra süreleri"
        onRowClick={(r) => navigate({ to: "/icra/$id", params: { id: r.enforcementId } })}
        rowActions={(r) => (
          <>
            <DropdownMenuItem
              onClick={() => navigate({ to: "/icra/$id", params: { id: r.enforcementId } })}
            >
              <ArrowRight /> Dosyaya git
            </DropdownMenuItem>
            {canEdit && r.eventId && !r.resolved && (
              <DropdownMenuItem onClick={() => setDone(r, true)}>
                <CheckCircle2 /> Tamamlandı
              </DropdownMenuItem>
            )}
            {canEdit && r.eventId && r.resolved && (
              <DropdownMenuItem onClick={() => setDone(r, false)}>
                <RotateCcw /> Yeniden aç
              </DropdownMenuItem>
            )}
          </>
        )}
        empty={
          <EmptyState
            icon={CheckCircle2}
            title="Bekleyen süre yok"
            description="Dosyaya takip şekli seçip 'Ödeme emri tebliği', '89/1 haciz ihbarnamesi' ya da 'Maaş haczi tebliği' işlemi girildiğinde süreler burada görünür."
          />
        }
        mobileCard={(r) => (
          <div className="flex items-start gap-3">
            <StatusBadge tone={PHASE_TONE[r.phase]} className="h-6 shrink-0">
              {r.phase}
            </StatusBadge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{DEADLINE_TITLES[r.kind]}</p>
              <p className="text-xs text-muted-foreground">
                {r.no} · {r.office}
              </p>
              <p className="text-xs text-muted-foreground">{r.client}</p>
              <p
                className={cn(
                  "mt-1 text-[12px]",
                  r.phase === "Gecikmiş" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground",
                )}
              >
                {formatDate(r.dueDate)} · {r.resolved ? "tamamlandı" : relativeDue(r.dueDate)}
              </p>
            </div>
          </div>
        )}
      />
    </PageShell>
  );
}
