import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, AlertTriangle } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { computeAlerts } from "@/lib/finance";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell, Section } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { AlertsPanel } from "@/components/dashboard/widgets";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/app/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({ meta: [{ title: "Bildirimler — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, currentUser, permissions, markNotificationsRead } = useErp();
  const navigate = useNavigate();
  const mine = state.notifications.filter((n) => n.userId === currentUser.id);
  const unread = mine.filter((n) => !n.read).length;
  const alertCount = computeAlerts(state, currentUser, permissions.viewFinance).length;

  return (
    <PageShell>
      <PageHeader
        title="Bildirimler"
        description={`${unread} okunmamış bildirim · ${alertCount} açık uyarı`}
        icon={Bell}
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={() => markNotificationsRead()}>
              <CheckCheck /> Tümünü okundu say
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
        <Section
          title="Bildirimler"
          description="Size atanan işler, müvekkil mesajları ve yüklemeler"
          bodyClassName="p-2"
        >
          {mine.length === 0 ? (
            <EmptyState icon={Bell} title="Bildirim yok" />
          ) : (
            <ul className="stagger">
              {mine.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationsRead([n.id]);
                      if (n.link) navigate({ to: n.link });
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/60",
                      !n.read && "bg-primary/[0.035]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-border" : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</span>
                        <StatusBadge tone="slate" dot={false} className="h-5 px-2 text-[10px]">
                          {n.type}
                        </StatusBadge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{n.detail}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div>
          <AlertsPanel limit={30} />
          <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Uyarılar canlı hesaplanır; ilgili kayıt
            düzeltildiğinde kendiliğinden kaybolur.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
