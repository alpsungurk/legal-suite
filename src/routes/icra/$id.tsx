import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  CheckCircle2,
  Gavel,
  HandCoins,
  MessageSquarePlus,
  Pencil,
  Phone,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { enforcementSummary, promiseStatus } from "@/lib/finance";
import { formatDate, formatDateLong, formatMoney, relativeDue } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import {
  Avatar,
  AvatarStack,
  DetailList,
  Money,
  PageShell,
  ProgressBar,
  Section,
} from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/icra/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { state, permissions, patch, remove } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const e = state.enforcements.find((x) => x.id === id);
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
  const promises = state.promises
    .filter((p) => p.enforcementId === e.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
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
  const can = permissions.manageRecords;

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: "İcra dosyaları", to: "/icra" }, { label: e.no }]}
        title={e.no}
        description={`${e.office} · ${e.type} takip · ${formatDateLong(e.openingDate)}`}
        meta={
          <>
            <StatusBadge status={e.status} />
            {client && (
              <Link
                to="/muvekkiller/$id"
                params={{ id: client.id }}
                className="text-sm font-medium text-muted-foreground hover:text-primary"
              >
                Alacaklı: {client.name}
              </Link>
            )}
          </>
        }
        actions={
          can && (
            <>
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
              <Button variant="outline" onClick={() => quick.open("enforcement", { record: e })}>
                <Pencil /> Düzenle
              </Button>
              <Button
                onClick={() =>
                  quick.open("collection", {
                    preset: { enforcementId: e.id, debtorId: e.debtorIds[0] },
                  })
                }
              >
                <HandCoins /> Tahsilat gir
              </Button>
            </>
          )
        }
      />

      <StatGrid>
        <StatTile
          label="Toplam alacak"
          value={formatMoney(s.claim)}
          icon={Target}
          tone="blue"
          hint={`Asıl ${formatMoney(e.principal)} + faiz ${formatMoney(e.interest)} + masraf ${formatMoney(e.costs)}`}
        />
        <StatTile
          label="Tahsil edilen"
          value={formatMoney(s.collected)}
          icon={TrendingUp}
          tone="green"
          hint={`%${Math.round(s.progress * 100)}`}
        />
        <StatTile label="Kalan" value={formatMoney(s.remaining)} icon={Wallet} tone="violet" />
        <StatTile
          label="Müvekkile aktarılacak"
          value={formatMoney(s.untransferred)}
          icon={Send}
          tone={s.untransferred ? "amber" : "green"}
          to="/banka-kasa"
        />
      </StatGrid>
      <div className="animate-fade-up">
        <ProgressBar
          value={s.progress}
          tone={s.progress >= 1 ? "green" : "primary"}
          className="h-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
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
                            ? "bg-emerald-500/10 text-emerald-600"
                            : st === "Gecikmiş" || st === "Tutulmadı"
                              ? "bg-rose-500/10 text-rose-600"
                              : "bg-amber-500/12 text-amber-600",
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
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={() => quick.open("promise", { record: p })}
                        >
                          <Pencil />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

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
                      className="font-semibold text-emerald-600 dark:text-emerald-400"
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
                        {permissions.deleteRecords && (
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
        </div>

        <div className="space-y-4">
          <Section title="Borçlular" bodyClassName="p-2">
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
                { label: "İcra dairesi", value: e.office },
                { label: "Takip türü", value: e.type },
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
            {e.note && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                {e.note}
              </p>
            )}
          </Section>
          <Section title="Görüşme notları" bodyClassName="p-4">
            {contacts.length === 0 ? (
              <EmptyState icon={MessageSquarePlus} title="Görüşme notu yok" compact />
            ) : (
              <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[15px] before:top-1 before:w-px before:bg-border">
                {contacts.map((c) => (
                  <li key={c.id} className="relative flex gap-3">
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
