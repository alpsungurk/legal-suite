import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  Gavel,
  HandCoins,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Phone,
  UserX,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { debtorSummary, enforcementSummary, promiseStatus } from "@/lib/finance";
import { formatDate, formatMoney, relativeDue } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, DetailList, Money, PageShell, ProgressBar, Section } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { ReliabilityBadge, StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/borclular/$id")({ component: Page });

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "");
  return `https://wa.me/90${digits}`;
}

function Page() {
  const { id } = Route.useParams();
  const { state, permissions } = useErp();
  const quick = useQuick();
  const d = state.debtors.find((x) => x.id === id);
  if (!d) {
    return (
      <PageShell>
        <EmptyState
          icon={UserX}
          title="Borçlu bulunamadı"
          action={
            <Button asChild variant="outline">
              <Link to="/borclular">Listeye dön</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }
  const s = debtorSummary(state, d.id);
  const promises = state.promises
    .filter((p) => p.debtorId === d.id)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const contacts = state.contacts
    .filter((c) => c.debtorId === d.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const userName = (uid: string) => state.users.find((u) => u.id === uid)?.name ?? "—";
  const enfNo = (eid: string) => state.enforcements.find((e) => e.id === eid)?.no ?? "";

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: "Borçlular", to: "/borclular" }, { label: d.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={d.name} size="lg" className="hidden sm:grid" />
            {d.name}
          </span>
        }
        meta={
          <>
            <StatusBadge tone="slate" dot={false}>
              {d.kind}
            </StatusBadge>
            <ReliabilityBadge value={s.reliability} />
          </>
        }
        actions={
          <>
            {d.phone && (
              <>
                <Button variant="outline" asChild>
                  <a href={`tel:${d.phone}`}>
                    <Phone /> Ara
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={waLink(d.phone)} target="_blank" rel="noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              </>
            )}
            {permissions.manageRecords && (
              <>
                <Button variant="outline" onClick={() => quick.open("debtor", { record: d })}>
                  <Pencil /> Düzenle
                </Button>
                <Button
                  onClick={() =>
                    quick.open("contact", {
                      preset: { debtorId: d.id, enforcementId: s.files[0]?.id },
                    })
                  }
                >
                  <MessageSquarePlus /> Görüşme notu
                </Button>
              </>
            )}
          </>
        }
      />
      <StatGrid>
        <StatTile
          label="Toplam borç"
          value={formatMoney(s.claim)}
          icon={Gavel}
          tone="blue"
          hint={`${s.files.length} icra dosyası`}
        />
        <StatTile
          label="Tahsil edilen"
          value={formatMoney(s.collected)}
          icon={HandCoins}
          tone="green"
        />
        <StatTile label="Kalan" value={formatMoney(s.remaining)} tone="violet" />
        <StatTile
          label="Ödeme sözü"
          value={s.promiseCount}
          icon={CalendarCheck}
          tone="amber"
          hint={promises.filter((p) => p.status === "Bekliyor").length + " bekleyen"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <Section title="İcra dosyaları" bodyClassName="p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {s.files.map((e) => {
                const es = enforcementSummary(state, e.id);
                return (
                  <Link
                    key={e.id}
                    to="/icra/$id"
                    params={{ id: e.id }}
                    className="interactive-card rounded-xl border border-border/80 bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{e.no}</p>
                      <StatusBadge status={e.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{e.office}</p>
                    <ProgressBar value={es.progress} className="mt-3" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(es.collected)} / {formatMoney(es.claim)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </Section>
          <Section title="Ödeme sözleri" bodyClassName="p-2">
            {promises.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Ödeme sözü yok" compact />
            ) : (
              <ul className="divide-y divide-border/60">
                {promises.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <Money value={p.amount} /> · {formatDate(p.dueDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enfNo(p.enforcementId)}
                        {p.status === "Bekliyor" && ` · ${relativeDue(p.dueDate)}`}
                      </p>
                    </div>
                    <StatusBadge status={promiseStatus(p)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="İletişim ve kimlik">
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: "TC / Vergi no", value: d.identity },
                { label: "Telefon", value: d.phone },
                {
                  label: "E-posta",
                  value: d.email && (
                    <a
                      href={`mailto:${d.email}`}
                      className="inline-flex items-center gap-1.5 hover:text-primary"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {d.email}
                    </a>
                  ),
                },
                { label: "Adres", value: d.address },
              ]}
            />
          </Section>
          <Section title="Malvarlığı">
            <p className="whitespace-pre-line text-sm">
              {d.assets || <span className="text-muted-foreground">Bilgi girilmemiş</span>}
            </p>
            {d.notes && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                {d.notes}
              </p>
            )}
          </Section>
          <Section title="Görüşme geçmişi">
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
                        {formatDate(c.date)} · {c.channel}
                        {c.enforcementId && ` · ${enfNo(c.enforcementId)}`}
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
