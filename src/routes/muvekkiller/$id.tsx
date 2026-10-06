import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarPlus,
  FilePlus2,
  FileText,
  KeyRound,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  PiggyBank,
  Plus,
  Printer,
  Receipt,
  Wallet,
  FileQuestion,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { clientFinance } from "@/lib/finance";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, DetailList, PageShell, Section } from "@/components/app/bits";
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
import {
  AdvanceTable,
  CaseTable,
  DocumentTable,
  ExpenseTable,
  LedgerTable,
  PlanTable,
  ReminderTable,
} from "@/components/lists/tables";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Search = { sekme?: string };

export const Route = createFileRoute("/muvekkiller/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    sekme: typeof s.sekme === "string" ? s.sekme : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { sekme = "genel" } = Route.useSearch();
  const navigate = useNavigate();
  const { state, permissions, accrueMonthlyFees } = useErp();
  const quick = useQuick();
  const [planId, setPlanId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const client = state.clients.find((c) => c.id === id);
  if (!client) {
    return (
      <PageShell>
        <EmptyState
          icon={FileText}
          title="Müvekkil bulunamadı"
          action={
            <Button asChild variant="outline">
              <Link to="/muvekkiller">Listeye dön</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const fin = permissions.viewFinance ? clientFinance(state, client.id) : null;
  const cases = state.cases.filter((c) => c.clientId === client.id);
  const caseIds = new Set(cases.map((c) => c.id));
  const expenses = state.expenses.filter(
    (e) => e.clientId === client.id || (e.caseId && caseIds.has(e.caseId)),
  );
  const advances = state.advances.filter((a) => a.clientId === client.id);
  const plans = state.plans.filter((p) => p.clientId === client.id);
  const docs = state.documents.filter(
    (d) => d.clientId === client.id || (d.caseId && caseIds.has(d.caseId)),
  );
  const reminders = state.reminders.filter(
    (r) => r.clientId === client.id || (r.caseId && caseIds.has(r.caseId)),
  );
  const portalUsers = state.users.filter((u) => u.role === "Müvekkil" && u.clientId === client.id);
  const requests = state.docRequests.filter((r) => r.clientId === client.id);

  const setTab = (t: string) =>
    navigate({ to: "/muvekkiller/$id", params: { id }, search: { sekme: t }, replace: true });

  return (
    <PageShell>
      <PageHeader
        crumbs={[{ label: "Müvekkiller", to: "/muvekkiller" }, { label: client.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={client.name} size="lg" className="hidden sm:grid" />
            {client.name}
          </span>
        }
        meta={
          <>
            <StatusBadge status={client.status} />
            <StatusBadge status={client.kind} tone="slate" dot={false} />
            {client.portalEnabled && <StatusBadge tone="cyan">Portal açık</StatusBadge>}
            {client.monthlyFee && (
              <StatusBadge tone="violet" dot={false}>
                Aylık {formatMoney(client.monthlyFee)}
              </StatusBadge>
            )}
          </>
        }
        actions={
          <>
            {permissions.viewFinance && (
              <Button variant="outline" asChild>
                <Link to="/yazdir/ekstre/$id" params={{ id: client.id }} target="_blank">
                  <Printer /> Ekstre PDF
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/mesajlar" search={{ musteri: client.id }}>
                <MessageSquare /> Mesaj
              </Link>
            </Button>
            {permissions.manageRecords && (
              <Button variant="outline" onClick={() => quick.open("client", { record: client })}>
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
                {permissions.manageRecords && (
                  <DropdownMenuItem
                    onClick={() => quick.open("case", { preset: { clientId: client.id } })}
                  >
                    <FilePlus2 /> Dosya
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => quick.open("expense", { preset: { clientId: client.id } })}
                >
                  <Receipt /> Masraf
                </DropdownMenuItem>
                {permissions.manageFinance && (
                  <>
                    <DropdownMenuItem
                      onClick={() => quick.open("advance", { preset: { clientId: client.id } })}
                    >
                      <PiggyBank /> Masraf avansı
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => quick.open("plan", { preset: { clientId: client.id } })}
                    >
                      <Wallet /> Tahsilat planı
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => quick.open("reminder", { preset: { clientId: client.id } })}
                >
                  <CalendarPlus /> Ajanda kaydı
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => quick.open("docRequest", { preset: { clientId: client.id } })}
                >
                  <FileQuestion /> Belge iste
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => quick.open("document", { preset: { clientId: client.id } })}
                >
                  <FileText /> Belge yükle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {fin && (
        <StatGrid>
          <StatTile
            label="Masraf avansı"
            value={formatMoney(fin.advance.balance)}
            icon={PiggyBank}
            tone={fin.advance.balance < 0 ? "red" : fin.lowAdvance ? "amber" : "green"}
            hint={`${formatMoney(fin.advance.received)} alındı · ${formatMoney(fin.advance.spent)} harcandı`}
          />
          <StatTile
            label="Ücret alacağı"
            value={formatMoney(fin.feeRemaining)}
            icon={Wallet}
            tone="blue"
            hint={
              fin.feeOverdue
                ? `${formatMoney(fin.feeOverdue)} gecikmiş`
                : `${formatMoney(fin.feePaid)} tahsil edildi`
            }
            hintTone={fin.feeOverdue ? "red" : "green"}
          />
          <StatTile
            label="Cari bakiye"
            value={formatMoney(Math.abs(fin.balance))}
            icon={Receipt}
            tone={fin.status === "Borçlu" ? "red" : "green"}
            hint={
              fin.status === "Borçlu"
                ? "Müvekkil borçlu"
                : fin.status === "Alacaklı"
                  ? "Müvekkil alacaklı (avans fazlası)"
                  : "Hesap kapalı"
            }
          />
          <StatTile
            label="Dosyalar"
            value={cases.length}
            icon={FileText}
            tone="violet"
            hint={`${cases.filter((c) => c.status !== "Kapalı").length} açık`}
          />
        </StatGrid>
      )}

      <Tabs value={sekme} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            <TabsTrigger value="genel">Genel</TabsTrigger>
            <TabsTrigger value="dosyalar">Dosyalar ({cases.length})</TabsTrigger>
            <TabsTrigger value="masraflar">Masraflar ({expenses.length})</TabsTrigger>
            {permissions.viewFinance && <TabsTrigger value="avanslar">Avanslar</TabsTrigger>}
            {permissions.viewFinance && (
              <TabsTrigger value="tahsilatlar">Tahsilatlar ({plans.length})</TabsTrigger>
            )}
            {permissions.viewFinance && <TabsTrigger value="ekstre">Cari ekstre</TabsTrigger>}
            <TabsTrigger value="belgeler">Belgeler ({docs.length})</TabsTrigger>
            <TabsTrigger value="ajanda">Ajanda</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="genel" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
            <Section title="İletişim ve kimlik">
              <DetailList
                items={[
                  {
                    label: "Telefon",
                    value: client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {client.phone}
                      </a>
                    ),
                  },
                  {
                    label: "E-posta",
                    value: client.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {client.email}
                      </a>
                    ),
                  },
                  {
                    label: client.kind === "Kurumsal" ? "Vergi no" : "TC kimlik",
                    value: client.identity,
                  },
                  { label: "Vergi dairesi", value: client.taxOffice },
                  { label: "Adres", value: client.address },
                  { label: "Kayıt tarihi", value: formatDate(client.createdAt.slice(0, 10)) },
                ]}
              />
              {client.notes && (
                <p className="mt-4 whitespace-pre-line rounded-xl bg-secondary/40 p-3 text-sm">
                  {client.notes}
                </p>
              )}
            </Section>
            <div className="space-y-4">
              {client.monthlyFee && permissions.manageFinance && (
                <Section
                  title="Aylık ücret"
                  description={`${formatMoney(client.monthlyFee)} · ${formatDate(client.monthlyFeeStartDate)} itibarıyla`}
                >
                  <p className="text-sm text-muted-foreground">
                    Bu ayın ücreti tahakkuk ettirilmediyse tek tıkla oluşturabilirsiniz.
                  </p>
                  <Button
                    variant="soft"
                    className="mt-3"
                    onClick={() => {
                      const period = new Date().toISOString().slice(0, 7);
                      const n = accrueMonthlyFees(period);
                      toast[n ? "success" : "info"](
                        n
                          ? `${formatPeriod(period)} ücreti tahakkuk edildi`
                          : "Bu dönem zaten tahakkuk edilmiş",
                      );
                    }}
                  >
                    Bu ayı tahakkuk ettir
                  </Button>
                </Section>
              )}
              <PortalCard clientId={client.id} enabled={client.portalEnabled} users={portalUsers} />
              {requests.length > 0 && (
                <Section title="Belge talepleri">
                  <ul className="space-y-2">
                    {requests.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{r.title}</span>
                        <StatusBadge status={r.status} />
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="dosyalar" className="mt-4">
          <CaseTable rows={cases} hide={{ client: true }} exportName={`${client.name} dosyalar`} />
        </TabsContent>
        <TabsContent value="masraflar" className="mt-4">
          <ExpenseTable
            rows={expenses}
            hide={{ client: true }}
            exportName={`${client.name} masraflar`}
          />
        </TabsContent>
        <TabsContent value="avanslar" className="mt-4">
          <AdvanceTable rows={advances} hide={{ client: true }} />
        </TabsContent>
        <TabsContent value="tahsilatlar" className="mt-4">
          <PlanTable rows={plans} hide={{ client: true }} onOpen={(p) => setPlanId(p.id)} />
        </TabsContent>
        <TabsContent value="ekstre" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-auto"
              aria-label="Başlangıç"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-auto"
              aria-label="Bitiş"
            />
            <Button variant="outline" size="sm" className="ml-auto h-9" asChild>
              <Link
                to="/yazdir/ekstre/$id"
                params={{ id: client.id }}
                search={{ from: from || undefined, to: to || undefined }}
                target="_blank"
              >
                <Printer /> Yazdır / PDF
              </Link>
            </Button>
          </div>
          <LedgerTable clientId={client.id} from={from || undefined} to={to || undefined} />
        </TabsContent>
        <TabsContent value="belgeler" className="mt-4">
          <DocumentTable rows={docs} hide={{ client: true }} />
        </TabsContent>
        <TabsContent value="ajanda" className="mt-4">
          <ReminderTable rows={reminders} />
        </TabsContent>
      </Tabs>
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}

function PortalCard({
  clientId,
  enabled,
  users,
}: {
  clientId: string;
  enabled: boolean;
  users: ReturnType<typeof useErp>["state"]["users"];
}) {
  const { state, permissions, patch } = useErp();
  const quick = useQuick();
  const client = state.clients.find((c) => c.id === clientId)!;
  return (
    <Section
      title="Müvekkil portalı"
      description={
        enabled ? "Müvekkil dosyalarını ve duruşmalarını görebilir" : "Portal erişimi kapalı"
      }
      actions={
        permissions.manageRecords && (
          <Button
            size="sm"
            variant={enabled ? "outline" : "soft"}
            onClick={() => patch("clients", clientId, { portalEnabled: !enabled })}
          >
            {enabled ? "Kapat" : "Aç"}
          </Button>
        )
      }
    >
      {users.length ? (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 text-sm">
              <Avatar name={u.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{u.username}</span>
                <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
              </span>
              {permissions.manageUsers && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => quick.open("user", { record: u })}
                  title="Düzenle / şifre"
                >
                  <KeyRound />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Bu müvekkil için portal kullanıcısı yok.</p>
      )}
      {permissions.manageUsers && users.length === 0 && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            quick.open("user", {
              preset: {
                role: "Müvekkil",
                clientId,
                name: client.name,
                email: client.email,
                username: client.name
                  .toLocaleLowerCase("tr")
                  .replace(/[^a-zçğıöşü0-9]+/g, "")
                  .slice(0, 16),
              },
            })
          }
        >
          <Plus /> Portal kullanıcısı oluştur
        </Button>
      )}
      {enabled && users.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Müvekkil <span className="font-medium">/giris</span> sayfasından kendi kullanıcı adıyla
          girer.
        </p>
      )}
    </Section>
  );
}
