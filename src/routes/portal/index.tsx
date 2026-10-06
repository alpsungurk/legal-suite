import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  FileQuestion,
  FolderKanban,
  MessagesSquare,
  Receipt,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { clientFinance } from "@/lib/finance";
import { formatDateLong, formatMoney, relativeDue, today } from "@/lib/format";
import { Section } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { DateChip } from "@/components/dashboard/widgets";
import { usePortalData } from "@/routes/portal/-data";

export const Route = createFileRoute("/portal/")({
  head: () => ({ meta: [{ title: "Müvekkil portalı — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, currentUser } = useErp();
  const { client, cases, events, requests, unread } = usePortalData();
  if (!client) return null;
  const fin = client.portalShowStatement ? clientFinance(state, client.id) : null;
  const upcoming = events.filter((e) => e.date >= today()).slice(0, 5);
  const pending = requests.filter((r) => r.status === "Bekliyor");

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="text-sm text-muted-foreground">{formatDateLong(today())}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          Merhaba, {currentUser.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.settings.firm.name} ile yürüttüğünüz işlerin güncel durumu
        </p>
      </header>

      <StatGrid>
        <StatTile
          label="Açık dosyalarım"
          value={cases.filter((c) => c.status !== "Kapalı").length}
          icon={FolderKanban}
          tone="blue"
          to="/portal/dosyalar"
        />
        <StatTile
          label="Sıradaki duruşma / randevu"
          value={upcoming[0] ? relativeDue(upcoming[0].date) : "—"}
          icon={CalendarDays}
          tone="violet"
          hint={upcoming[0]?.title}
        />
        {fin ? (
          <StatTile
            label="Hesap bakiyesi"
            value={formatMoney(Math.abs(fin.balance))}
            icon={Receipt}
            tone={fin.balance > 0 ? "amber" : "green"}
            hint={
              fin.balance > 0.005
                ? "Ödenecek tutar"
                : fin.balance < -0.005
                  ? "Lehinize bakiye"
                  : "Bakiye yok"
            }
            to="/portal/ekstre"
          />
        ) : (
          <StatTile
            label="Mesajlar"
            value={unread}
            icon={MessagesSquare}
            tone="green"
            hint="okunmamış"
            to="/portal/mesajlar"
          />
        )}
        <StatTile
          label="İstenen belgeler"
          value={pending.length}
          icon={FileQuestion}
          tone={pending.length ? "red" : "green"}
          hint={pending.length ? "Yüklemeniz bekleniyor" : "Bekleyen talep yok"}
          to="/portal/belgeler"
        />
      </StatGrid>

      {pending.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 animate-fade-up dark:border-amber-900/60 dark:bg-amber-950/30 sm:flex-row sm:items-center">
          <FileQuestion className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Avukatınız sizden belge bekliyor</p>
            <p className="text-muted-foreground">{pending.map((r) => r.title).join(", ")}</p>
          </div>
          <Button asChild size="sm">
            <Link to="/portal/belgeler">Belgeleri yükle</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Yaklaşan duruşma ve randevular" bodyClassName="p-2">
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Planlanmış bir tarih yok" compact />
          ) : (
            <ul className="stagger">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  <DateChip date={e.date} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[e.time, e.location].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{relativeDue(e.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section
          title="Dosyalarım"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/dosyalar">
                Tümü <ArrowRight />
              </Link>
            </Button>
          }
          bodyClassName="p-2"
        >
          <ul className="stagger">
            {cases.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.court, c.esasNo].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
            {cases.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Görüntülenecek dosya yok
              </p>
            )}
          </ul>
        </Section>
      </div>
    </div>
  );
}
