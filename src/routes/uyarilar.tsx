import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Gavel,
  Hourglass,
  Info,
  Timer,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Alert } from "@/lib/finance";
import { formatDate, relativeDue } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { alertIcon, toneStyle, useAlerts } from "@/components/dashboard/widgets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/uyarilar")({
  head: () => ({ meta: [{ title: "Dikkat gerektirenler — Avukat Yönetim Paneli" }] }),
  component: Page,
});

const CATEGORIES: Array<{ key: Alert["category"]; icon: LucideIcon }> = [
  { key: "Taksit", icon: Wallet },
  { key: "Ödeme sözü", icon: Gavel },
  { key: "Ajanda", icon: Clock },
  { key: "Haciz", icon: Hourglass },
  { key: "Süre", icon: Timer },
];

const PRIORITY: Record<Alert["tone"], { label: string; rank: number; tone: "red" | "amber" | "blue" | "green" }> = {
  danger: { label: "Acil", rank: 0, tone: "red" },
  warning: { label: "Yaklaşan", rank: 1, tone: "amber" },
  info: { label: "Bilgi", rank: 2, tone: "blue" },
  success: { label: "Tamam", rank: 3, tone: "green" },
};

/** Canlı hesaplanan bütün uyarılar: sayılar, filtre, tarih aralığı ve sıralama */
function Page() {
  const alerts = useAlerts();
  const navigate = useNavigate();
  const urgent = alerts.filter((a) => a.tone === "danger").length;

  const columns: Column<Alert>[] = [
    {
      id: "priority",
      header: "Öncelik",
      sort: (a) => PRIORITY[a.tone].rank,
      export: (a) => PRIORITY[a.tone].label,
      cell: (a) => (
        <StatusBadge tone={PRIORITY[a.tone].tone} className="h-6">
          {PRIORITY[a.tone].label}
        </StatusBadge>
      ),
    },
    {
      id: "title",
      header: "Konu",
      sort: (a) => a.title,
      export: (a) => `${a.title} · ${a.detail}`,
      cell: (a) => {
        const Icon = alertIcon[a.category] ?? Info;
        return (
          <div className="flex min-w-0 max-w-[560px] items-center gap-3">
            <span
              className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", toneStyle[a.tone])}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.title}</p>
              <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "category",
      header: "Tür",
      hideBelow: "md",
      sort: (a) => a.category,
      export: (a) => a.category,
      cell: (a) => (
        <StatusBadge tone="slate" dot={false} className="h-5 px-2 text-[12px]">
          {a.category}
        </StatusBadge>
      ),
    },
    {
      id: "date",
      header: "Tarih",
      align: "right",
      sort: (a) => a.date,
      export: (a) => formatDate(a.date),
      cell: (a) => (
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-medium",
              a.tone === "danger" ? "text-rose-600 dark:text-rose-400" : "",
            )}
          >
            {relativeDue(a.date)}
          </p>
          <p className="text-[12px] text-muted-foreground">{formatDate(a.date)}</p>
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Dikkat gerektirenler"
        description="Canlı hesaplanır; ilgili kayıt düzelince listeden kendiliğinden kalkar."
        icon={AlertTriangle}
        actions={
          <Button variant="outline" asChild>
            <Link to="/bildirimler">
              <ArrowLeft /> Bildirimler
            </Link>
          </Button>
        }
      />

      <StatGrid>
        <StatTile
          label="Dikkat gerektiren"
          value={alerts.length}
          icon={AlertTriangle}
          tone={urgent ? "red" : alerts.length ? "amber" : "green"}
          hint={urgent ? `${urgent} acil` : alerts.length ? "Acil yok" : "Her şey yolunda"}
          hintTone={urgent ? "red" : "green"}
        />
        {CATEGORIES.map((c) => {
          const list = alerts.filter((a) => a.category === c.key);
          const u = list.filter((a) => a.tone === "danger").length;
          return (
            <StatTile
              key={c.key}
              label={c.key}
              value={list.length}
              icon={c.icon}
              tone={u ? "red" : list.length ? "amber" : "green"}
              hint={u ? `${u} acil` : list.length ? "Yaklaşıyor" : "Yok"}
              hintTone={u ? "red" : undefined}
            />
          );
        })}
      </StatGrid>

      <DataTable
        rows={alerts}
        columns={columns}
        getId={(a) => a.id}
        searchText={(a) => [a.title, a.detail, a.category]}
        searchPlaceholder="Uyarılarda ara..."
        filters={[
          {
            id: "priority",
            label: "Öncelik",
            options: ["Acil", "Yaklaşan", "Bilgi"],
            get: (a) => PRIORITY[a.tone].label,
          },
          {
            id: "category",
            label: "Tür",
            options: CATEGORIES.map((c) => c.key).filter((k) => alerts.some((a) => a.category === k)),
            get: (a) => a.category,
          },
        ]}
        dateRange={{ label: "Tarih", get: (a) => a.date }}
        initialSort={{ id: "priority" }}
        pageSize={30}
        exportName="Dikkat gerektirenler"
        onRowClick={(a) => navigate({ to: a.link })}
        rowActions={(a) => (
          <DropdownMenuItem onClick={() => navigate({ to: a.link })}>
            <ArrowRight /> İlgili kayda git
          </DropdownMenuItem>
        )}
        empty={
          <EmptyState
            icon={CheckCircle2}
            title="Bekleyen uyarı yok"
            description="Geciken ödeme, yaklaşan süre ya da haciz düşme tarihi bulunmuyor."
          />
        }
        mobileCard={(a) => {
          const Icon = alertIcon[a.category] ?? Info;
          return (
            <div className="flex items-start gap-3">
              <span
                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneStyle[a.tone])}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.detail}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="font-medium">{a.category}</span>
                  <span className={cn(a.tone === "danger" && "text-rose-600 dark:text-rose-400")}>
                    {relativeDue(a.date)}
                  </span>
                </p>
              </div>
            </div>
          );
        }}
      />
    </PageShell>
  );
}
