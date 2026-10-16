import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellDot,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useErp } from "@/lib/erp-store";
import { addDays, formatDateTime, timeAgo, today } from "@/lib/format";
import type { AppNotification } from "@/lib/erp-types";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertRows, useAlerts } from "@/components/dashboard/widgets";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({ meta: [{ title: "Bildirimler — Avukat Yönetim Paneli" }] }),
  component: Page,
});

type N = AppNotification;

function Page() {
  const { state, currentUser, markNotificationsRead } = useErp();
  const navigate = useNavigate();

  const mine = useMemo(
    () => state.notifications.filter((n) => n.userId === currentUser.id),
    [state.notifications, currentUser.id],
  );
  const t = today();
  const unread = mine.filter((n) => !n.read);
  const todays = mine.filter((n) => n.createdAt.slice(0, 10) === t);
  const week = mine.filter((n) => n.createdAt.slice(0, 10) >= addDays(t, -6));
  const types = [...new Set(mine.map((n) => n.type).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const typeCounts = types
    .map((ty) => ({ ty, n: mine.filter((x) => x.type === ty).length }))
    .sort((a, b) => b.n - a.n);

  const open = (n: N) => {
    if (!n.read) markNotificationsRead([n.id]);
    if (n.link) navigate({ to: n.link });
  };

  const columns: Column<N>[] = [
    {
      id: "read",
      header: "Durum",
      sort: (n) => (n.read ? 1 : 0),
      export: (n) => (n.read ? "Okundu" : "Okunmadı"),
      cell: (n) => (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", n.read ? "bg-border" : "bg-primary")} />
          {n.read ? "Okundu" : "Yeni"}
        </span>
      ),
    },
    {
      id: "title",
      header: "Bildirim",
      sort: (n) => n.title,
      export: (n) => n.title,
      cell: (n) => (
        <div className="min-w-0 max-w-[560px]">
          <p className={cn("truncate text-sm", !n.read && "font-semibold")}>{n.title}</p>
          {n.detail && <p className="truncate text-xs text-muted-foreground">{n.detail}</p>}
        </div>
      ),
    },
    {
      id: "type",
      header: "Tür",
      hideBelow: "md",
      sort: (n) => n.type,
      export: (n) => n.type,
      cell: (n) =>
        n.type ? (
          <StatusBadge tone="slate" dot={false} className="h-5 px-2 text-[12px]">
            {n.type}
          </StatusBadge>
        ) : null,
    },
    {
      id: "date",
      header: "Tarih",
      align: "right",
      sort: (n) => n.createdAt,
      export: (n) => formatDateTime(n.createdAt),
      cell: (n) => (
        <div className="text-right">
          <p className="text-sm">{timeAgo(n.createdAt)}</p>
          <p className="text-[12px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Bildirimler"
        description="Size atanan işler, haciz, taksit ve ajanda hatırlatmaları"
        icon={Bell}
        actions={
          <>
            <AlertsButton />
            {unread.length > 0 && (
              <Button variant="outline" onClick={() => markNotificationsRead()}>
                <CheckCheck /> Tümünü okundu say
              </Button>
            )}
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Okunmamış"
          value={unread.length}
          icon={BellDot}
          tone={unread.length ? "red" : "green"}
          hint={unread.length ? "Okunmayı bekliyor" : "Hepsi okundu"}
          hintTone={unread.length ? "red" : "green"}
        />
        <StatTile label="Bugün" value={todays.length} icon={CalendarClock} tone="blue" />
        <StatTile label="Son 7 gün" value={week.length} icon={Bell} tone="violet" />
        <StatTile
          label="Toplam"
          value={mine.length}
          icon={Inbox}
          tone="amber"
          hint={
            typeCounts.length
              ? typeCounts
                  .slice(0, 3)
                  .map((x) => `${x.ty} ${x.n}`)
                  .join(" · ")
              : "Bildirim yok"
          }
        />
      </StatGrid>

      <DataTable
        rows={mine}
        columns={columns}
        getId={(n) => n.id}
        searchText={(n) => [n.title, n.detail, n.type]}
        searchPlaceholder="Bildirimlerde ara..."
        filters={[
          {
            id: "read",
            label: "Durum",
            options: ["Okunmamış", "Okundu"],
            get: (n) => (n.read ? "Okundu" : "Okunmamış"),
          },
          ...(types.length ? [{ id: "type", label: "Tür", options: types, get: (n: N) => n.type }] : []),
        ]}
        dateRange={{ label: "Tarih", get: (n) => n.createdAt.slice(0, 10) }}
        initialSort={{ id: "date", desc: true }}
        pageSize={30}
        exportName="Bildirimler"
        onRowClick={open}
        rowClassName={(n) => (n.read ? undefined : "bg-primary/[0.04]")}
        selectable
        bulkActions={(selected, clear) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              markNotificationsRead(selected.filter((n) => !n.read).map((n) => n.id));
              clear();
            }}
          >
            <CheckCheck /> Okundu say ({selected.length})
          </Button>
        )}
        rowActions={(n) => (
          <>
            {n.link && (
              <DropdownMenuItem onClick={() => open(n)}>
                <ArrowRight /> İlgili kayda git
              </DropdownMenuItem>
            )}
            {!n.read && (
              <DropdownMenuItem onClick={() => markNotificationsRead([n.id])}>
                <CheckCheck /> Okundu say
              </DropdownMenuItem>
            )}
          </>
        )}
        empty={
          <EmptyState
            icon={Bell}
            title="Bildirim yok"
            description="Size atanan işler, haciz ve taksit hatırlatmaları burada listelenir."
          />
        }
        mobileCard={(n) => (
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                n.read ? "bg-border" : "bg-primary",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
              {n.detail && <p className="text-xs text-muted-foreground">{n.detail}</p>}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {n.type && <span className="font-medium">{n.type}</span>}
                <span>{timeAgo(n.createdAt)}</span>
              </p>
            </div>
          </div>
        )}
      />
    </PageShell>
  );
}

/** Sağ üstte "Dikkat gerektirenler": sayı rozeti; tıklayınca ilk uyarılar açılır, "Tümü" tam listeye gider */
function AlertsButton() {
  const alerts = useAlerts();
  const [open, setOpen] = useState(false);
  const urgent = alerts.filter((a) => a.tone === "danger").length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <AlertTriangle className={cn(urgent > 0 && "text-rose-600 dark:text-rose-400")} />
          Dikkat gerektirenler
          {alerts.length > 0 && (
            <span
              className={cn(
                "ml-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[12px] font-semibold",
                urgent > 0 ? "bg-rose-500 text-white" : "bg-secondary text-foreground",
              )}
            >
              {alerts.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Dikkat gerektirenler</p>
            <p className="text-xs text-muted-foreground">
              {alerts.length ? `${alerts.length} konu · ${urgent} acil` : "Her şey yolunda"}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/uyarilar" onClick={() => setOpen(false)}>
              Tümü <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2" onClick={() => setOpen(false)}>
          {alerts.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Bekleyen uyarı yok" compact />
          ) : (
            <AlertRows alerts={alerts.slice(0, 8)} />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
