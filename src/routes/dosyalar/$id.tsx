import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarPlus,
  FileText,
  FolderKanban,
  Gavel,
  Pencil,
  PiggyBank,
  Plus,
  Printer,
  Receipt,
  Wallet,
  Clock,
  CircleDot,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { advanceBalance, caseFinance, enforcementSummary } from "@/lib/finance";
import { formatDate, formatDateLong, formatMoney, relativeDue, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import {
  AvatarStack,
  DetailList,
  Money,
  PageShell,
  ProgressBar,
  Section,
} from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { DocumentTable, ExpenseTable, PlanTable, ReminderTable } from "@/components/lists/tables";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type Search = { sekme?: string };

export const Route = createFileRoute("/dosyalar/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    sekme: typeof s.sekme === "string" ? s.sekme : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { sekme = "ozet" } = Route.useSearch();
  const navigate = useNavigate();
  const { state, permissions } = useErp();
  const quick = useQuick();
  const [planId, setPlanId] = useState<string | null>(null);

  const c = state.cases.find((x) => x.id === id);
  if (!c) {
    return (
      <PageShell>
        <EmptyState
          icon={FolderKanban}
          title="Dosya bulunamadı"
          action={
            <Button asChild variant="outline">
              <Link to="/dosyalar">Listeye dön</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }
  const client = state.clients.find((x) => x.id === c.clientId);
  const fin = caseFinance(state, c.id);
  const adv = client ? advanceBalance(state, client.id, c.id) : null;
  const expenses = state.expenses.filter((e) => e.caseId === c.id);
  const plans = state.plans.filter((p) => p.caseId === c.id);
  const reminders = state.reminders.filter((r) => r.caseId === c.id);
  const docs = state.documents.filter((d) => d.caseId === c.id);
  const enfs = state.enforcements.filter((e) => e.caseId === c.id);
  const responsible = c.responsibleIds.map(
    (uid) => state.users.find((u) => u.id === uid)?.name ?? "?",
  );
  const next = reminders
    .filter((r) => r.status === "Bekliyor" && r.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const setTab = (t: string) =>
    navigate({ to: "/dosyalar/$id", params: { id }, search: { sekme: t }, replace: true });

  // Zaman çizelgesi
  const timeline = [
    ...reminders.map((r) => ({
      date: r.date,
      icon: Clock,
      title: `${r.type}: ${r.title}`,
      detail: r.status === "Tamamlandı" ? "Tamamlandı" : (r.location ?? ""),
      tone: r.status === "Tamamlandı" ? "muted" : r.date < today() ? "red" : "blue",
    })),
    ...expenses.map((e) => ({
      date: e.date,
      icon: Receipt,
      title: `Masraf: ${e.title}`,
      detail: formatMoney(e.amount),
      tone: "amber",
    })),
    ...docs.map((d) => ({
      date: d.createdAt.slice(0, 10),
      icon: FileText,
      title: `Belge: ${d.name}`,
      detail: d.category,
      tone: "violet",
    })),
    {
      date: c.openingDate,
      icon: CircleDot,
      title: "Dosya açıldı",
      detail: c.court ?? "",
      tone: "green",
    },
    ...(c.closingDate
      ? [
          {
            date: c.closingDate,
            icon: CircleDot,
            title: "Dosya kapandı",
            detail: "",
            tone: "muted",
          },
        ]
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const toneDot: Record<string, string> = {
    red: "bg-rose-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    green: "bg-emerald-500",
    muted: "bg-muted-foreground/40",
  };

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: "Dosyalar", to: "/dosyalar" }, { label: c.no }]}
        title={
          <span>
            <span className="mr-2 text-primary">{c.no}</span>
            {c.title}
          </span>
        }
        meta={
          <>
            <StatusBadge status={c.status} />
            <StatusBadge status={c.type} tone="slate" dot={false} />
            {client && (
              <Link
                to="/muvekkiller/$id"
                params={{ id: client.id }}
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                {client.name}
              </Link>
            )}
          </>
        }
        actions={
          <>
            {permissions.viewFinance && (
              <Button variant="outline" asChild>
                <Link to="/yazdir/dosya/$id" params={{ id: c.id }} target="_blank">
                  <Printer /> Masraf dökümü
                </Link>
              </Button>
            )}
            {permissions.manageRecords && (
              <Button variant="outline" onClick={() => quick.open("case", { record: c })}>
                <Pencil /> Düzenle
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus /> Ekle
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() =>
                    quick.open("expense", { preset: { caseId: c.id, clientId: c.clientId } })
                  }
                >
                  <Receipt /> Masraf
                </DropdownMenuItem>
                {permissions.manageFinance && client && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        quick.open("advance", { preset: { clientId: client.id, caseId: c.id } })
                      }
                    >
                      <PiggyBank /> Masraf avansı
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        quick.open("plan", {
                          preset: { clientId: client.id, caseId: c.id, total: c.agreedFee },
                        })
                      }
                    >
                      <Wallet /> Tahsilat planı
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    quick.open("reminder", { preset: { caseId: c.id, clientId: c.clientId } })
                  }
                >
                  <CalendarPlus /> Duruşma / görev
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    quick.open("document", { preset: { caseId: c.id, clientId: c.clientId } })
                  }
                >
                  <FileText /> Belge
                </DropdownMenuItem>
                {permissions.manageRecords && client && (
                  <DropdownMenuItem
                    onClick={() =>
                      quick.open("enforcement", { preset: { caseId: c.id, clientId: client.id } })
                    }
                  >
                    <Gavel /> İcra takibi başlat
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Toplam masraf"
          value={formatMoney(fin.expenseTotal)}
          icon={Receipt}
          tone="amber"
          hint={`${expenses.length} kalem · ${formatMoney(fin.chargedTotal)} müvekkile yansıyan`}
        />
        {permissions.viewFinance && adv ? (
          <>
            <StatTile
              label="Avans bakiyesi"
              value={formatMoney(adv.balance)}
              icon={PiggyBank}
              tone={adv.balance < 0 ? "red" : "green"}
              hint="Müvekkilin genel avansı dahil"
            />
            <StatTile
              label="Ücret"
              value={formatMoney(fin.feePaid)}
              icon={Wallet}
              tone="blue"
              hint={`${formatMoney(fin.feeTotal)} üzerinden · kalan ${formatMoney(fin.feeRemaining)}`}
            />
          </>
        ) : (
          <StatTile label="Belgeler" value={docs.length} icon={FileText} tone="violet" />
        )}
        <StatTile
          label="Sıradaki"
          value={next ? next.type : "—"}
          icon={Clock}
          tone="violet"
          hint={
            next
              ? `${formatDateLong(next.date)} · ${relativeDue(next.date)}`
              : "Planlanmış kayıt yok"
          }
        />
      </StatGrid>

      <Tabs value={sekme} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            <TabsTrigger value="ozet">Özet</TabsTrigger>
            <TabsTrigger value="ajanda">Ajanda ({reminders.length})</TabsTrigger>
            <TabsTrigger value="masraflar">Masraflar ({expenses.length})</TabsTrigger>
            {permissions.viewFinance && (
              <TabsTrigger value="tahsilatlar">Tahsilatlar ({plans.length})</TabsTrigger>
            )}
            <TabsTrigger value="belgeler">Belgeler ({docs.length})</TabsTrigger>
            {enfs.length > 0 && <TabsTrigger value="icra">İcra ({enfs.length})</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="ozet" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.4fr)]">
            <div className="space-y-4">
              <Section title="Dosya bilgileri">
                <DetailList
                  className="sm:grid-cols-1"
                  items={[
                    { label: "Mahkeme / merci", value: c.court },
                    { label: "Esas no", value: c.esasNo },
                    { label: "Karşı taraf", value: c.opposingParty },
                    { label: "Sorumlu", value: <AvatarStack names={responsible} max={5} /> },
                    { label: "Açılış", value: formatDateLong(c.openingDate) },
                    ...(c.closingDate
                      ? [{ label: "Kapanış", value: formatDateLong(c.closingDate) }]
                      : []),
                    ...(c.agreedFee && permissions.viewFinance
                      ? [{ label: "Anlaşılan ücret", value: formatMoney(c.agreedFee) }]
                      : []),
                    { label: "Müvekkil portalı", value: c.portalVisible ? "Görünür" : "Gizli" },
                  ]}
                />
                {c.note && (
                  <p className="mt-4 whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                    {c.note}
                  </p>
                )}
              </Section>
              {permissions.viewFinance && fin.feeTotal > 0 && (
                <Section title="Ücret tahsilatı">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Tahsil edilen</span>
                    <span>
                      <Money value={fin.feePaid} className="font-semibold" /> /{" "}
                      <Money value={fin.feeTotal} className="text-muted-foreground" />
                    </span>
                  </div>
                  <ProgressBar value={fin.feeTotal ? fin.feePaid / fin.feeTotal : 0} />
                </Section>
              )}
            </div>
            <Section title="Zaman çizelgesi" description="Duruşmalar, masraflar ve belgeler">
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
                {timeline.slice(0, 20).map((ev, i) => (
                  <li
                    key={i}
                    className="relative flex gap-4 pl-0 animate-fade-up"
                    style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                  >
                    <span
                      className={cn(
                        "relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-card",
                        toneDot[ev.tone],
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.detail && <p className="text-xs text-muted-foreground">{ev.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(ev.date)}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        </TabsContent>
        <TabsContent value="ajanda" className="mt-4">
          <ReminderTable rows={reminders} />
        </TabsContent>
        <TabsContent value="masraflar" className="mt-4">
          <ExpenseTable rows={expenses} hide={{ case: true }} exportName={`${c.no} masraflar`} />
        </TabsContent>
        <TabsContent value="tahsilatlar" className="mt-4">
          <PlanTable
            rows={plans}
            hide={{ case: true, client: true }}
            onOpen={(p) => setPlanId(p.id)}
          />
        </TabsContent>
        <TabsContent value="belgeler" className="mt-4">
          <DocumentTable rows={docs} hide={{ case: true }} />
        </TabsContent>
        <TabsContent value="icra" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {enfs.map((e) => {
              const s = enforcementSummary(state, e.id);
              return (
                <Link
                  key={e.id}
                  to="/icra/$id"
                  params={{ id: e.id }}
                  className="interactive-card rounded-2xl border border-border/80 bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{e.no}</p>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{e.office}</p>
                  <ProgressBar value={s.progress} className="mt-3" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatMoney(s.collected)} / {formatMoney(s.claim)} tahsil edildi
                  </p>
                </Link>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}
