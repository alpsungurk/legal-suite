import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Gavel,
  HandCoins,
  Hourglass,
  ListPlus,
  ListTree,
  MessageSquarePlus,
  Pencil,
  Phone,
  Receipt,
  CalendarRange,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
  Send,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import {
  DEADLINE_TITLES,
  enforcementSummary,
  icraDeadlines,
  promiseStatus,
  seizureDueDate,
  seizureWarning,
} from "@/lib/finance";
import { CLOSED_ENFORCEMENT_STATUS, STOPPED_ENFORCEMENT_STATUS } from "@/lib/erp-types";
import { EventDataSummary, doneData } from "@/components/icra/event-data";
import { procedureRule } from "@/components/forms/other";
import {
  addDays,
  formatDate,
  formatDateLong,
  formatMoney,
  relativeDue,
  today,
} from "@/lib/format";
import { ExpenseTable } from "@/components/lists/tables";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Avatar,
  AvatarStack,
  DetailList,
  Money,
  NoAccess,
  PageShell,
  ProgressBar,
  Section,
} from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import {
  useDeleteContact,
  useDeleteEnforcement,
  useDeletePromise,
} from "@/components/forms/delete-actions";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/icra/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { state, permissions, patch, remove, currentUser } = useErp();
  const quick = useQuick();
  // Hook'lar erken dönüşlerden (dosya bulunamadı) önce çağrılmalı
  const deleteEnforcement = useDeleteEnforcement();
  const deletePromise = useDeletePromise();
  const deleteContact = useDeleteContact();
  const confirm = useConfirm();
  const e = state.enforcements.find((x) => x.id === id);
  if (!permissions.can("enforcements")) return <NoAccess />;
  if (!e) {
    return (
      <PageShell>
        <EmptyState
          icon={Gavel}
          title="İcra dosyası bulunamadı"
          action={
            <Button asChild variant="outline">
              <Link to="/icra">Listeye dön</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }
  const s = enforcementSummary(state, e.id);
  const client = state.clients.find((c) => c.id === e.clientId);
  const debtors = state.debtors.filter((d) => e.debtorIds.includes(d.id));
  const allPromises = state.promises.filter((p) => p.enforcementId === e.id);
  const promises = allPromises
    .filter((p) => !p.planId)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  // Borçluya tanımlanan taksit planları
  const plans = [...new Set(allPromises.filter((p) => p.planId).map((p) => p.planId!))].map(
    (planId) => {
      const items = allPromises
        .filter((p) => p.planId === planId)
        .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0));
      return {
        planId,
        items,
        debtorId: items[0].debtorId,
        total: items.reduce((t, p) => t + p.amount, 0),
        kept: items.filter((p) => p.status === "Tutuldu").length,
      };
    },
  );
  const expenses = state.expenses.filter(
    (x) =>
      x.enforcementId === e.id && (permissions.can("expenses") || x.createdBy === currentUser.id),
  );
  const collections = state.collections
    .filter((c) => c.enforcementId === e.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const contacts = state.contacts
    .filter(
      (c) => c.enforcementId === e.id || (!c.enforcementId && e.debtorIds.includes(c.debtorId)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const kase = state.cases.find((c) => c.id === e.caseId);
  const debtorName = (did: string) => state.debtors.find((d) => d.id === did)?.name ?? "—";
  const userName = (uid: string) => state.users.find((u) => u.id === uid)?.name ?? "—";
  const canCreate = permissions.can("enforcements", "create");
  const canEdit = permissions.can("enforcements", "edit");
  const canDelete = permissions.can("enforcements", "delete");
  const canExpense = permissions.can("expenses", "create");
  const can = canCreate || canEdit;
  // Borçlu olduğumuz dosyada tahsilat, ödeme sözü ve taksit yok
  const owed = e.side === "Borçlu";
  const listLink = owed ? "/icra/borclu" : "/icra";
  const due = owed ? undefined : seizureDueDate(e, state.settings.seizureValidMonths);
  const hz = seizureWarning(e, state.settings);
  const events = state.events
    .filter((x) => x.enforcementId === e.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  // Bu dosyanın bekleyen süreleri (kesinleştirme, 89/2, işveren…); haciz ve taksit yukarıda ayrıca görünür
  const deadlines = icraDeadlines(state).filter(
    (d) =>
      d.enforcementId === e.id &&
      !d.resolved &&
      d.kind !== "Haciz yenileme" &&
      d.kind !== "Taksit / ödeme sözü",
  );
  const procedure = state.settings.procedures.find((p) => p.name === e.procedure);
  // Avukatın bu dosya için kendine koyduğu hatırlatmalar (Ajanda kayıtları)
  const canRemind = permissions.can("reminders", "create");
  const reminders = state.reminders
    .filter(
      (r) =>
        r.enforcementId === e.id &&
        r.status === "Bekliyor" &&
        (permissions.can("reminders") || r.assigneeId === currentUser.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const addReminder = () =>
    quick.open("reminder", {
      preset: {
        enforcementId: e.id,
        clientId: e.clientId,
        caseId: e.caseId,
        title: `${e.no} · kontrol`,
        date: addDays(today(), 7),
      },
    });

  return (
    <PageShell>
      <PageHeader
        crumbs={[
          { label: owed ? "Borçlu olduğumuz" : "Alacaklı olduğumuz", to: listLink },
          { label: e.no },
        ]}
        title={e.no}
        description={`${e.office} · ${e.type} takip · ${formatDateLong(e.openingDate)}`}
        meta={
          <>
            <StatusBadge status={e.status} />
            <StatusBadge tone={owed ? "amber" : "blue"}>
              {owed ? "Borçlu olduğumuz" : "Alacaklı olduğumuz"}
            </StatusBadge>
            {e.status === STOPPED_ENFORCEMENT_STATUS && e.stopReason && (
              <span className="text-sm text-muted-foreground">Sebep: {e.stopReason}</span>
            )}
            {e.status === CLOSED_ENFORCEMENT_STATUS && e.closeReason && (
              <span className="text-sm text-muted-foreground">Sebep: {e.closeReason}</span>
            )}
            {client && (
              <Link
                to="/muvekkiller/$id"
                params={{ id: client.id }}
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                {owed ? "Borçlu" : "Alacaklı"}: {client.name}
              </Link>
            )}
          </>
        }
        actions={
          can && (
            <>
              {canCreate && (
                <Button
                  variant="outline"
                  onClick={() =>
                    quick.open("contact", {
                      preset: { enforcementId: e.id, debtorId: e.debtorIds[0] },
                    })
                  }
                >
                  <MessageSquarePlus /> Görüşme notu
                </Button>
              )}
              {can && (
                <Button
                  variant="outline"
                  onClick={() =>
                    quick.open("enforcementEvent", { preset: { enforcementId: e.id } })
                  }
                >
                  <ListPlus /> İşlem ekle
                </Button>
              )}
              {canCreate && !owed && (
                <Button
                  variant="outline"
                  onClick={() =>
                    quick.open("debtorPlan", {
                      preset: { enforcementId: e.id, debtorId: e.debtorIds[0] },
                    })
                  }
                >
                  <CalendarRange /> Taksit tanımla
                </Button>
              )}
              {canExpense && (
                <Button
                  variant="outline"
                  onClick={() =>
                    quick.open("expense", {
                      preset: { chargeTo: "Müvekkil", enforcementId: e.id, clientId: e.clientId },
                    })
                  }
                >
                  <Receipt /> Masraf ekle
                </Button>
              )}
              {canCreate && !owed && (
                <Button
                  variant="outline"
                  onClick={() =>
                    quick.open("promise", {
                      preset: { enforcementId: e.id, debtorId: e.debtorIds[0] },
                    })
                  }
                >
                  <CalendarCheck /> Ödeme sözü
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" onClick={() => quick.open("enforcement", { record: e })}>
                  <Pencil /> Düzenle
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void deleteEnforcement(e)}
                >
                  <Trash2 /> Sil
                </Button>
              )}
              {canCreate && !owed && (
                <Button
                  onClick={() =>
                    quick.open("collection", {
                      preset: { enforcementId: e.id, debtorId: e.debtorIds[0] },
                    })
                  }
                >
                  <HandCoins /> Tahsilat gir
                </Button>
              )}
            </>
          )
        }
      />

      <StatGrid>
        <StatTile
          label="Takip çıkış rakamı"
          value={formatMoney(s.claim)}
          icon={Target}
          tone="blue"
          hint={`Takip tarihi ${formatDate(e.openingDate)}`}
        />
        {owed ? (
          <StatTile
            label="İşlem geçmişi"
            value={events.length}
            icon={ListTree}
            tone="violet"
            hint={events[0] ? `Son: ${events[0].type} · ${formatDate(events[0].date)}` : "Henüz işlem yok"}
          />
        ) : (
          <>
            <StatTile
              label="Tahsil edilen"
              value={formatMoney(s.collected)}
              icon={TrendingUp}
              tone="green"
              hint={`%${Math.round(s.progress * 100)} · kalan ${formatMoney(s.remaining)}`}
            />
            <StatTile
              label="Haczin düşeceği tarih"
              value={due ? formatDate(due) : "—"}
              icon={Hourglass}
              tone={hz ? "red" : "violet"}
              hint={
                due
                  ? hz
                    ? relativeDue(due)
                    : `Son haciz ${formatDate(e.lastSeizureDate)}`
                  : "Son haciz tarihi girilmedi"
              }
              hintTone={hz ? "red" : undefined}
            />
            <StatTile
              label="Müvekkile aktarılacak"
              value={formatMoney(s.untransferred)}
              icon={Send}
              tone={s.untransferred ? "amber" : "green"}
              to="/banka-kasa"
              hint={s.untransferred ? "Banka & Kasa'dan aktarın" : "Aktarılacak tutar yok"}
            />
          </>
        )}
      </StatGrid>
      {!owed && (
        <div className="animate-fade-up">
          <ProgressBar
            value={s.progress}
            tone={s.progress >= 1 ? "green" : "primary"}
            className="h-2"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          {deadlines.length > 0 && (
            <Section
              title="Bekleyen süreler"
              description={procedureRule(procedure) ?? "Takip şekli seçilmedi"}
              bodyClassName="p-0"
            >
              <ul className="divide-y">
                {deadlines.map((d) => {
                  const ev = state.events.find((x) => x.id === d.eventId);
                  const late = d.dueDate < today();
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                          late
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        <Timer className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{DEADLINE_TITLES[d.kind]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(d.dueDate)} · {relativeDue(d.dueDate)}
                          {ev && ` · ${ev.type} ${formatDate(ev.date)}`}
                        </p>
                      </div>
                      {can && ev && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            patch("events", ev.id, { data: doneData(ev, true) });
                            toast.success("Süre tamamlandı olarak işaretlendi");
                          }}
                        >
                          <CheckCircle2 /> Tamamlandı
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
          {(reminders.length > 0 || canRemind) && (
            <Section
              title="Hatırlatmalar"
              description="Bu dosya için kendinize koyduğunuz kontrol günleri"
              actions={
                canRemind && (
                  <Button size="sm" variant="outline" onClick={addReminder}>
                    <Bell /> Hatırlatma ekle
                  </Button>
                )
              }
              bodyClassName="p-0"
            >
              {reminders.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Bekleyen hatırlatma yok. İşlem eklerken "Kontrol hatırlatması" seçerek ya da buradan
                  ekleyebilirsiniz.
                </p>
              ) : (
                <ul className="divide-y">
                  {reminders.map((r) => {
                    const late = r.date < today();
                    const mine = r.assigneeId === currentUser.id;
                    return (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                            late
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                          )}
                        >
                          <Bell className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(r.date)} · {relativeDue(r.date)}
                            {!mine && ` · ${userName(r.assigneeId)}`}
                          </p>
                          {r.note && (
                            <p className="mt-0.5 whitespace-pre-line text-sm">{r.note}</p>
                          )}
                        </div>
                        {(mine || permissions.can("reminders", "edit")) && (
                          <span className="flex items-center gap-1">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => quick.open("reminder", { record: r })}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                patch("reminders", r.id, { status: "Tamamlandı" });
                                toast.success("Hatırlatma tamamlandı");
                              }}
                            >
                              <CheckCircle2 /> Tamamlandı
                            </Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}
          <Section
            title="İşlem geçmişi"
            description="Tebliğ, itiraz, kesinleştirme, sorgu, haciz ve banka cevapları"
            actions={
              can && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    quick.open("enforcementEvent", { preset: { enforcementId: e.id } })
                  }
                >
                  <ListPlus /> İşlem ekle
                </Button>
              )
            }
            bodyClassName="p-4"
          >
            {events.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title="Henüz işlem yok"
                description="Ödeme emri tebliği, sorgu, haciz gibi adımları buraya ekleyin. Excel'deki açıklamalar aşağıda 'Açıklamalar' bölümünde durur."
                compact
              />
            ) : (
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-px before:bg-border">
                {events.map((ev) => (
                  <li key={ev.id} className="group relative flex gap-3 pl-6">
                    <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-card bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{ev.type}</span>
                        {ev.inquiryType && ` · ${ev.inquiryType}`}
                        {ev.seizureType && ` · ${ev.seizureType}`}
                        {ev.result && (
                          <StatusBadge
                            className="ml-2 h-5 px-2 text-[12px]"
                            tone={
                              /olumlu/i.test(ev.result) && !/olumsuz/i.test(ev.result)
                                ? "green"
                                : /olumsuz/i.test(ev.result)
                                  ? "red"
                                  : "amber"
                            }
                          >
                            {ev.result}
                          </StatusBadge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(ev.date)}
                        {ev.debtorId && ` · ${debtorName(ev.debtorId)}`}
                        {ev.amount != null && ` · ${formatMoney(ev.amount)}`}
                      </p>
                      <EventDataSummary data={ev.data} />
                      {ev.note && <p className="mt-0.5 whitespace-pre-line text-sm">{ev.note}</p>}
                    </div>
                    {can && (
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => quick.open("enforcementEvent", { record: ev })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="hover:text-destructive"
                          onClick={async () => {
                            if (await confirm({ title: "İşlem kaydı silinsin mi?" }))
                              remove("events", ev.id);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {!owed && plans.length > 0 && (
            <Section
              title="Taksitler"
              description="Borçluya tanımlanan ödeme planları"
              bodyClassName="p-2"
            >
              <div className="space-y-4">
                {plans.map((pl) => (
                  <div key={pl.planId}>
                    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{debtorName(pl.debtorId)}</span>
                      <span>
                        {pl.kept}/{pl.items.length} ödendi · <Money value={pl.total} />
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {pl.items.map((p) => {
                        const st = promiseStatus(p);
                        return (
                          <li
                            key={p.id}
                            className={cn(
                              "group flex flex-wrap items-center gap-3 rounded-xl px-3 py-2",
                              st === "Gecikmiş" && "bg-rose-50/60 dark:bg-rose-950/20",
                            )}
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                              {p.installmentNo}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                <Money value={p.amount} /> · {formatDate(p.dueDate)}
                              </p>
                              {p.status === "Bekliyor" && (
                                <p className="text-xs text-muted-foreground">
                                  {relativeDue(p.dueDate)}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={st} />
                            {can && p.status === "Bekliyor" && (
                              <Button
                                size="sm"
                                variant="soft"
                                onClick={() =>
                                  quick.open("collection", {
                                    preset: {
                                      enforcementId: e.id,
                                      debtorId: p.debtorId,
                                      amount: p.amount,
                                      promiseId: p.id,
                                    },
                                  })
                                }
                              >
                                <CheckCircle2 /> Ödendi
                              </Button>
                            )}
                            {can && (
                              <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => quick.open("promise", { record: p })}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="hover:text-destructive"
                                  title="Sil"
                                  onClick={() => void deletePromise(p)}
                                >
                                  <Trash2 />
                                </Button>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {!owed && (
          <Section
            title="Ödeme sözleri"
            description="Borçlunun taahhütleri ve gerçekleşme durumu"
            bodyClassName="p-2"
          >
            {promises.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Ödeme sözü yok" compact />
            ) : (
              <ul className="stagger space-y-1">
                {promises.map((p) => {
                  const st = promiseStatus(p);
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "group flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5",
                        st === "Gecikmiş" && "bg-rose-50/60 dark:bg-rose-950/20",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-lg",
                          st === "Tutuldu"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : st === "Gecikmiş" || st === "Tutulmadı"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                        )}
                      >
                        <CalendarCheck className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          <Money value={p.amount} /> · {formatDate(p.dueDate)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {debtorName(p.debtorId)}
                          {p.status === "Bekliyor" && ` · ${relativeDue(p.dueDate)}`}
                          {p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      <StatusBadge status={st} />
                      {can && p.status === "Bekliyor" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() =>
                              quick.open("collection", {
                                preset: {
                                  enforcementId: e.id,
                                  debtorId: p.debtorId,
                                  amount: p.amount,
                                  promiseId: p.id,
                                },
                              })
                            }
                          >
                            <CheckCircle2 /> Tutuldu
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Tutulmadı"
                            onClick={() => {
                              patch("promises", p.id, { status: "Tutulmadı" });
                              toast("Söz tutulmadı olarak işaretlendi");
                            }}
                          >
                            <XCircle />
                          </Button>
                        </div>
                      )}
                      {can && (
                        <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => quick.open("promise", { record: p })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="hover:text-destructive"
                            title="Sil"
                            onClick={() => void deletePromise(p)}
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          )}

          {!owed && (
          <Section title="Tahsilatlar" bodyClassName="p-2">
            {collections.length === 0 ? (
              <EmptyState icon={HandCoins} title="Henüz tahsilat yok" compact />
            ) : (
              <ul className="divide-y divide-border/60">
                {collections.map((c) => (
                  <li key={c.id} className="group flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {formatDate(c.date)} · {debtorName(c.debtorId)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.method} · {state.accounts.find((a) => a.id === c.accountId)?.name ?? "—"}
                        {c.note && ` · ${c.note}`}
                      </p>
                    </div>
                    <StatusBadge tone={c.transferredToClient ? "green" : "amber"}>
                      {c.transferredToClient ? "Aktarıldı" : "Aktarılacak"}
                    </StatusBadge>
                    <Money
                      value={c.amount}
                      className="font-semibold text-emerald-600 dark:text-emerald-400 dark:text-emerald-400"
                    />
                    {can && (
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => quick.open("collection", { record: c })}
                        >
                          <Pencil />
                        </Button>
                        {canDelete && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="hover:text-destructive"
                            onClick={async () => {
                              if (await confirm({ title: "Tahsilat silinsin mi?" })) {
                                remove("collections", c.id);
                                if (c.promiseId)
                                  patch("promises", c.promiseId, { status: "Bekliyor" });
                              }
                            }}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          )}

          <Section title="Masraflar" description="Bu icra dosyası için yapılan masraflar">
            {expenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Masraf yok"
                compact
                action={
                  can ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        quick.open("expense", {
                          preset: {
                            chargeTo: "Müvekkil",
                            enforcementId: e.id,
                            clientId: e.clientId,
                          },
                        })
                      }
                    >
                      Masraf ekle
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ExpenseTable
                rows={expenses}
                hide={{ client: true }}
                exportName={`${e.no} masraflar`}
              />
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title={owed ? "Alacaklı (karşı taraf)" : "Borçlular"} bodyClassName="p-2">
            <ul className="space-y-1">
              {debtors.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-1 rounded-xl pr-2 transition-colors hover:bg-secondary/60"
                >
                  <Link
                    to="/borclular/$id"
                    params={{ id: d.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
                  >
                    <Avatar name={d.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.phone ?? d.kind}</p>
                    </div>
                  </Link>
                  {d.phone && (
                    <a
                      href={`tel:${d.phone}`}
                      aria-label={`${d.name} ara`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Dosya bilgileri">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "Taraf", value: owed ? "Borçlu olduğumuz" : "Alacaklı olduğumuz" },
                { label: "Birim", value: e.office },
                { label: "Dosya no", value: e.no },
                { label: "Takip türü", value: e.type },
                { label: "Takip şekli", value: e.procedure || undefined },
                { label: "Takip tarihi", value: formatDate(e.openingDate) },
                ...(owed
                  ? []
                  : [
                      {
                        label: "Son haciz tarihi",
                        value: e.lastSeizureDate ? formatDate(e.lastSeizureDate) : undefined,
                      },
                      {
                        label: "Haczin düşeceği tarih",
                        value: due ? (
                          <span className={cn(hz && "font-semibold text-rose-600 dark:text-rose-400")}>
                            {formatDate(due)} · {relativeDue(due)}
                          </span>
                        ) : undefined,
                      },
                    ]),
                ...(e.status === STOPPED_ENFORCEMENT_STATUS
                  ? [{ label: "Durdurulma sebebi", value: e.stopReason || "—" }]
                  : []),
                ...(e.status === CLOSED_ENFORCEMENT_STATUS
                  ? [{ label: "Kapanış sebebi", value: e.closeReason || "—" }]
                  : []),
                { label: "Sorumlu", value: <AvatarStack names={e.responsibleIds.map(userName)} /> },
                {
                  label: "İlgili dava",
                  value: kase ? (
                    <Link
                      to="/dosyalar/$id"
                      params={{ id: kase.id }}
                      className="hover:text-primary"
                    >
                      {kase.no} · {kase.title}
                    </Link>
                  ) : undefined,
                },
              ]}
            />
            {e.details && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Takip bilgileri</p>
                <p className="whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                  {e.details}
                </p>
              </div>
            )}
            {e.note && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Açıklamalar</p>
                <p className="whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                  {e.note}
                </p>
              </div>
            )}
          </Section>
          <Section title="Görüşme notları" bodyClassName="p-4">
            {contacts.length === 0 ? (
              <EmptyState icon={MessageSquarePlus} title="Görüşme notu yok" compact />
            ) : (
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[15px] before:top-1 before:w-px before:bg-border">
                {contacts.map((c) => (
                  <li key={c.id} className="group relative flex gap-3">
                    <Avatar
                      name={userName(c.userId)}
                      size="sm"
                      className="relative ring-4 ring-card"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(c.date)} · {c.channel} · {userName(c.userId)}
                      </p>
                      <p className="mt-0.5 text-sm">{c.note}</p>
                    </div>
                    {can && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        title="Sil"
                        onClick={() => void deleteContact(c)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
