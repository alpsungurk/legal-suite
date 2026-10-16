import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Building,
  Building2,
  Clock,
  DatabaseBackup,
  Download,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
  Upload,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { FormDialog } from "@/components/app/FormDialog";
import { passwordProblem } from "@/lib/auth";
import { Avatar, PageShell, Section } from "@/components/app/bits";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { AttachmentChip, FileDrop } from "@/components/app/files";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import {
  LOCKED_CASE_STATUSES,
  LOCKED_ENFORCEMENT_STATUSES,
  LOCKED_FEE_KINDS,
  type CategoryKey,
  type FirmProfile,
  type Settings as SettingsT,
  type User,
} from "@/lib/erp-types";
import { exportBackup, readBackup } from "@/lib/backup";
import { displayEmail, formatIban } from "@/lib/format";
import { sendSentryTest, sentryEnabled } from "@/lib/sentry";
import { PermissionsTab } from "@/components/settings/PermissionsTab";
import { CronTab } from "@/components/settings/CronTab";
import { CompanyListsTab } from "@/components/settings/CompanyListsTab";
import { formatDate, today } from "@/lib/format";
import { cn } from "@/lib/utils";
import { archiveCandidates } from "@/lib/finance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Search = { sekme?: string };

export const Route = createFileRoute("/ayarlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    sekme: typeof s.sekme === "string" ? s.sekme : undefined,
  }),
  head: () => ({ meta: [{ title: "Ayarlar — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const { permissions } = useErp();
  const navigate = useNavigate();
  const { sekme } = Route.useSearch();
  // Yetkisi olmayan sekmeler adresle de açılamaz
  // Admin hepsini görür; avukat yalnızca İzinler'de kendisine açılan bölümleri görür
  const sa = permissions.settingsAccess;
  const visibleTabs = [
    sa.firm.view && "buro",
    (permissions.manageUsers || sa.users.view) && "kullanicilar",
    permissions.manageUsers && "izinler",
    sa.categories.view && "kategoriler",
    sa.companies.view && "sirketler",
    "hesabim",
    sa.backup.view && "yedek",
    permissions.manageSettings && "zamanlama",
  ].filter(Boolean) as string[];
  const allowed = new Set(visibleTabs);
  const tab = sekme && allowed.has(sekme) ? sekme : visibleTabs[0];
  const setTab = (t: string) => navigate({ to: "/ayarlar", search: { sekme: t }, replace: true });

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Ayarlar"
        description="Büro bilgileri, kullanıcılar, kategoriler ve veri yedekleme"
        icon={Settings}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            {sa.firm.view && (
              <TabsTrigger value="buro">
                <Building2 className="mr-1.5 h-4 w-4" /> Büro
              </TabsTrigger>
            )}
            {(permissions.manageUsers || sa.users.view) && (
              <TabsTrigger value="kullanicilar">
                <Users className="mr-1.5 h-4 w-4" /> Kullanıcılar
              </TabsTrigger>
            )}
            {permissions.manageUsers && (
              <TabsTrigger value="izinler">
                <ShieldCheck className="mr-1.5 h-4 w-4" /> İzinler
              </TabsTrigger>
            )}
            {sa.categories.view && (
              <TabsTrigger value="kategoriler">
                <Tags className="mr-1.5 h-4 w-4" /> Kategoriler
              </TabsTrigger>
            )}
            {sa.companies.view && (
              <TabsTrigger value="sirketler">
                <Building className="mr-1.5 h-4 w-4" /> Şirket listeleri
              </TabsTrigger>
            )}
            <TabsTrigger value="hesabim">
              <UserCog className="mr-1.5 h-4 w-4" /> Hesabım
            </TabsTrigger>
            {sa.backup.view && (
              <TabsTrigger value="yedek">
                <DatabaseBackup className="mr-1.5 h-4 w-4" /> Yedekleme
              </TabsTrigger>
            )}
            {permissions.manageSettings && (
              <TabsTrigger value="zamanlama">
                <Clock className="mr-1.5 h-4 w-4" /> Zamanlama
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="buro" className="mt-4">
          <FirmTab canEdit={sa.firm.edit} />
        </TabsContent>
        <TabsContent value="kullanicilar" className="mt-4">
          <UsersTab canCreate={sa.users.create} canEdit={sa.users.edit} />
        </TabsContent>
        <TabsContent value="izinler" className="mt-4">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="kategoriler" className="mt-4">
          <CategoriesTab access={sa.categories} />
        </TabsContent>
        <TabsContent value="sirketler" className="mt-4">
          <CompanyListsTab access={sa.companies} />
        </TabsContent>
        <TabsContent value="hesabim" className="mt-4">
          <AccountTab />
        </TabsContent>
        <TabsContent value="yedek" className="mt-4">
          <BackupTab />
        </TabsContent>
        <TabsContent value="zamanlama" className="mt-4">
          <CronTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

/* ───────────── Büro ───────────── */

function FirmTab({ canEdit }: { canEdit: boolean }) {
  const { state, updateSettings, organization } = useErp();
  const [firm, setFirm] = useState<FirmProfile>(state.settings.firm);
  useEffect(() => setFirm(state.settings.firm), [state.settings.firm]);
  const dirty = JSON.stringify(firm) !== JSON.stringify(state.settings.firm);
  const field = (
    key: keyof FirmProfile,
    label: string,
    opts?: { placeholder?: string; span?: boolean },
  ) => (
    <label className={opts?.span ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="text-[14px] font-medium">{label}</span>
      <Input
        value={(firm[key] as string) ?? ""}
        placeholder={opts?.placeholder}
        disabled={!canEdit}
        onChange={(e) => setFirm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <div className="space-y-4">
      <Section
        title="Organizasyon"
        description="Büronuzun çalışma alanı. Tüm kullanıcılar ve kayıtlar bu organizasyona bağlıdır."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Organizasyon", organization.name],
              ["Organizasyon kodu", organization.id],
              [
                "Kuruluş",
                organization.createdAt ? formatDate(organization.createdAt.slice(0, 10)) : "—",
              ],
              ["Kullanıcı", `${state.users.filter((u) => u.active).length} aktif`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="truncate text-sm font-semibold" title={value}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Organizasyon adı aşağıdaki "Kısa ad" alanından değiştirilir.
        </p>
      </Section>
      <Section title="Büro bilgileri" description="Ekstre ve dökümlerin başlığında görünür">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("name", "Kısa ad", { placeholder: "Lex Hukuk Bürosu" })}
          {field("legalName", "Resmi ünvan")}
          {field("phone", "Telefon")}
          {field("email", "E-posta")}
          {field("address", "Adres", { span: true })}
          {field("taxOffice", "Vergi dairesi")}
          {field("taxNo", "Vergi no")}
          {field("bankName", "Banka")}
          {field("iban", "IBAN", { placeholder: "TR.." })}
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[14px] font-medium">Ekstre alt notu</span>
            <Textarea
              value={firm.statementNote}
              disabled={!canEdit}
              onChange={(e) => setFirm((f) => ({ ...f, statementNote: e.target.value }))}
              rows={2}
            />
          </label>
        </div>
      </Section>
      <Section title="Logo" description="PDF ekstre ve dökümlerde kullanılır (PNG/JPG önerilir)">
        {firm.logo ? (
          <AttachmentChip
            file={firm.logo}
            onRemove={canEdit ? () => setFirm((f) => ({ ...f, logo: undefined })) : undefined}
          />
        ) : !canEdit ? (
          <p className="text-sm text-muted-foreground">Logo yüklenmemiş.</p>
        ) : (
          <FileDrop
            accept="image/*"
            multiple={false}
            label="Logo yükleyin"
            hint="Kare ya da yatay görsel"
            onFiles={(refs) => setFirm((f) => ({ ...f, logo: refs[0] }))}
          />
        )}
      </Section>
      <div className={canEdit ? "sticky bottom-4 z-10 flex justify-end" : "hidden"}>
        <div
          className={
            dirty
              ? "flex gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-elevated backdrop-blur animate-fade-up"
              : "hidden"
          }
        >
          <Button variant="ghost" onClick={() => setFirm(state.settings.firm)}>
            Vazgeç
          </Button>
          <Button
            onClick={() => {
              updateSettings({
                firm: { ...firm, iban: firm.iban.replace(/\s+/g, "").toUpperCase() },
              });
              toast.success("Büro bilgileri kaydedildi");
            }}
          >
            Değişiklikleri kaydet
          </Button>
        </div>
      </div>
      {!dirty && firm.iban && (
        <p className="text-xs text-muted-foreground">IBAN: {formatIban(firm.iban)}</p>
      )}
    </div>
  );
}

/* ───────────── Kullanıcılar ───────────── */

function UsersTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const readOnly = !canCreate && !canEdit;
  const { state, currentUser, remove, patch, setUserPassword, permissions } = useErp();
  // Admin olmayan "kullanıcı yönetimi" yetkilisi Admin hesaplarına dokunamaz (veritabanı da engeller)
  const lockedRow = (u: User) =>
    !permissions.manageUsers && u.role === "Admin" && u.id !== currentUser.id;
  const [resetFor, setResetFor] = useState<(typeof state.users)[number] | null>(null);
  const quick = useQuick();
  const confirm = useConfirm();
  const navigate = useNavigate();
  // Kendi hesabını yönetici kullanıcı listesinden değil, Profil ayarlarından düzenler
  const edit = (u: (typeof state.users)[number]) =>
    u.id === currentUser.id
      ? navigate({ to: "/ayarlar", search: { sekme: "hesabim" } })
      : quick.open("user", { record: u });
  const clientName = (id?: string) => state.clients.find((c) => c.id === id)?.name;
  const columns: Column<User>[] = [
    {
      id: "name",
      header: "Kullanıcı",
      sort: (u) => u.name,
      export: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {u.name}{" "}
              {u.id === currentUser.id && (
                <span className="text-xs text-muted-foreground">(siz)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {displayEmail(u.email) || `@${u.username}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "username",
      header: "Kullanıcı adı",
      hideBelow: "md",
      export: (u) => u.username,
      cell: (u) => <span className="font-mono text-sm">{u.username}</span>,
    },
    {
      id: "role",
      header: "Rol",
      sort: (u) => u.role,
      export: (u) => u.role,
      cell: (u) => <StatusBadge status={u.role} />,
    },
    {
      id: "active",
      header: "Durum",
      export: (u) => (u.active ? "Aktif" : "Pasif"),
      cell: (u) => <StatusBadge status={u.active ? "Aktif" : "Pasif"} />,
    },
  ];
  return (
    <Section
      title="Kullanıcılar"
      description={
        readOnly
          ? "Büro kullanıcıları (yalnızca görüntüleme; ekleme ve düzenleme için yetki gerekir)"
          : permissions.manageUsers
            ? "Büro kullanıcıları (admin ve avukat)"
            : "Büro kullanıcıları. Yalnızca avukat hesapları yönetilir; Admin hesaplarına dokunamazsınız"
      }
      actions={
        !canCreate ? undefined : (
          <Button size="sm" onClick={() => quick.open("user")}>
            <Plus /> Kullanıcı ekle
          </Button>
        )
      }
      bodyClassName="p-0"
    >
      <FormDialog
        open={!!resetFor}
        onOpenChange={(o) => !o && setResetFor(null)}
        title={`Şifre sıfırla: ${resetFor?.name ?? ""}`}
        description="Verdiğiniz geçici şifreyle giriş yapınca kullanıcı kendi yeni şifresini belirlemek zorunda kalır."
        submitLabel="Geçici şifreyi ata"
        fields={[
          {
            name: "password",
            label: "Geçici şifre",
            type: "text",
            required: true,
            span: 2,
            autoFocus: true,
            hint: "En az 8 karakter",
          },
        ]}
        initial={{ password: "" }}
        validate={(v) => {
          const p = passwordProblem(String(v.password ?? ""));
          return p ? { password: p } : undefined;
        }}
        onSubmit={async (v) => {
          if (!resetFor) return;
          const r = await setUserPassword(resetFor.id, String(v.password));
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          toast.success("Geçici şifre atandı; kullanıcı ilk girişte yenisini belirleyecek");
          setResetFor(null);
        }}
      />
      <DataTable
        className="rounded-none border-0 shadow-none"
        rows={state.users}
        columns={columns}
        getId={(u) => u.id}
        searchText={(u) => [u.name, u.username, displayEmail(u.email)]}
        filters={[
          {
            id: "role",
            label: "Rol",
            options: ["Admin", "Avukat"],
            get: (u) => u.role,
          },
        ]}
        exportName="Kullanıcılar"
        onRowClick={!canEdit ? undefined : (u) => !lockedRow(u) && edit(u)}
        rowActions={
          !canEdit
            ? undefined
            : (u) =>
                lockedRow(u) ? null : (
          <>
            <DropdownMenuItem onClick={() => edit(u)}>
              <Pencil /> {u.id === currentUser.id ? "Profil ayarları" : "Düzenle"}
            </DropdownMenuItem>
            {u.id !== currentUser.id && (
              <>
                <DropdownMenuItem onClick={() => setResetFor(u)}>
                  <Lock /> Şifre sıfırla
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    if (
                      u.active &&
                      !(await confirm({
                        title: `${u.name} pasife alınsın mı?`,
                        description:
                          "Kullanıcı giriş yapamaz. Kayıtları ve geçmişi silinmez; istediğiniz zaman tekrar etkinleştirebilirsiniz.",
                      }))
                    )
                      return;
                    patch("users", u.id, { active: !u.active });
                    toast.success(u.active ? "Kullanıcı pasife alındı" : "Kullanıcı etkinleştirildi");
                  }}
                >
                  <KeyRound /> {u.active ? "Pasife al" : "Etkinleştir"}
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      />
    </Section>
  );
}

/* ───────────── Kategoriler ───────────── */

type CatKey = CategoryKey;

const CAT_GROUPS: Array<{
  title: string;
  items: Array<{ key: CatKey; title: string; desc: string; locked?: string[]; canEmpty?: boolean }>;
}> = [
  {
    title: "Dosyalar",
    items: [
      { key: "caseTypes", title: "Dosya türleri", desc: "Dava, icra, danışmanlık..." },
      {
        key: "caseStatuses",
        title: "Dosya durumları",
        desc: "Açık, derdest, karar... (Kapalı dosyayı kapatır)",
        locked: LOCKED_CASE_STATUSES,
      },
      {
        key: "courts",
        title: "Mahkemeler",
        desc: "Dosya açarken listeden seçilir; yeni yazılan mahkeme buraya eklenir",
        canEmpty: true,
      },
      {
        key: "documentCategories",
        title: "Belge kategorileri",
        desc: "Dilekçe, karar, vekaletname...",
      },
      { key: "reminderTypes", title: "Ajanda türleri", desc: "Duruşma, süre sonu, toplantı..." },
    ],
  },
  {
    title: "Masraf ve tahsilat",
    items: [
      { key: "expenseTypes", title: "Masraf türleri", desc: "Harç, bilirkişi, tebligat..." },
      {
        key: "feeKinds",
        title: "Ücret türleri",
        desc: "Vekalet ücreti, danışmanlık... (Aylık ücret otomatik tahakkukta kullanılır)",
        locked: LOCKED_FEE_KINDS,
      },
      { key: "paymentMethods", title: "Ödeme yöntemleri", desc: "Nakit, havale, kredi kartı..." },
    ],
  },
  {
    title: "İcra",
    items: [
      {
        key: "enforcementStatuses",
        title: "İcra durumları",
        desc: "Açık, durdurulmuş, kapalı... (kilitliler otomatik kullanılır)",
        locked: LOCKED_ENFORCEMENT_STATUSES,
      },
      {
        key: "enforcementStopReasons",
        title: "Durdurulma sebepleri",
        desc: "Durum \"Durdurulmuş\" seçilince sorulur",
      },
      { key: "enforcementTypes", title: "Takip türleri", desc: "İlamsız, ilamlı, kambiyo..." },
      {
        key: "enforcementOffices",
        title: "İcra daireleri",
        desc: "Takip açarken listeden seçilir; yeni yazılan daire buraya eklenir",
        canEmpty: true,
      },
      {
        key: "contactChannels",
        title: "Görüşme kanalları",
        desc: "Telefon, WhatsApp, yüz yüze...",
      },
    ],
  },
  {
    title: "İcra işlem geçmişi",
    items: [
      {
        key: "enforcementEventTypes",
        title: "İşlem türleri",
        desc: "Tebliğ, itiraz, kesinleştirme, sorgu, haciz... (Sorgu ve Haciz ek alan açar)",
        locked: ["Sorgu", "Haciz"],
      },
      {
        key: "inquiryTypes",
        title: "Sorgu türleri",
        desc: "Araç, taşınmaz, banka, SGK, firma...",
      },
      { key: "seizureTypes", title: "Haciz türleri", desc: "Araç, taşınmaz, maaş, banka..." },
      {
        key: "resultTypes",
        title: "Sorgu / haciz sonuçları",
        desc: "Olumlu, olumsuz, düşük miktar...",
      },
    ],
  },
];

/** Kapalı dava dosyalarının saklanma süresi */
function ClosedCaseSettings({ canEdit }: { canEdit: boolean }) {
  const { state, updateSettings } = useErp();
  const current = state.settings.closedCaseRetentionMonths;
  const [months, setMonths] = useState(String(current));
  useEffect(() => setMonths(String(current)), [current]);
  const m = Number(months);
  const valid = Number.isInteger(m) && m >= 1 && m <= 120;
  const closed = state.cases.filter((c) => c.status === "Kapalı").length;
  return (
    <Section
      title="Kapalı dosyaların saklanma süresi"
      description={`Kapatılan dava dosyası bu süre boyunca kayıtlarıyla birlikte saklanır; süre dolunca bir sonraki ay başında (her ayın 1'i) otomatik silinir; müvekkilde yalnızca toplam alacak / verecek ve ücret toplamları kalır. Şu an ${closed} kapalı dosya var.`}
    >
      <form
        inert={!canEdit}
        className={cn("flex flex-wrap items-end gap-3", !canEdit && "opacity-60")}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) {
            toast.error("Süre 1–120 ay olmalı");
            return;
          }
          updateSettings({ closedCaseRetentionMonths: m });
          toast.success("Saklama süresi kaydedildi");
        }}
      >
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium">Kapanıştan sonra kaç ay saklansın</span>
          <Input
            type="number"
            min={1}
            max={120}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="w-40"
          />
        </label>
        <Button type="submit" disabled={m === current}>
          Kaydet
        </Button>
      </form>
    </Section>
  );
}

/** Haczin geçerlilik süresi ve hatırlatma zamanı */
function SeizureSettings({ canEdit }: { canEdit: boolean }) {
  const { state, updateSettings } = useErp();
  const [months, setMonths] = useState(String(state.settings.seizureValidMonths));
  const [days, setDays] = useState(String(state.settings.seizureReminderDays));
  useEffect(() => {
    setMonths(String(state.settings.seizureValidMonths));
    setDays(String(state.settings.seizureReminderDays));
  }, [state.settings.seizureValidMonths, state.settings.seizureReminderDays]);
  const m = Number(months);
  const d = Number(days);
  const valid = Number.isInteger(m) && m >= 1 && m <= 60 && Number.isInteger(d) && d >= 1 && d <= 120;
  const dirty =
    m !== state.settings.seizureValidMonths || d !== state.settings.seizureReminderDays;
  return (
    <Section
      title="Haciz süresi ve hatırlatma"
      description="Haczin düşeceği tarih = son haciz tarihi + süre. Bu tarihten belirtilen gün kadar önce dosya sorumlularına bildirim gider (her gün 08:00)."
    >
      <form
        inert={!canEdit}
        className={cn("flex flex-wrap items-end gap-3", !canEdit && "opacity-60")}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) {
            toast.error("Süre 1–60 ay, hatırlatma 1–120 gün olmalı");
            return;
          }
          updateSettings({ seizureValidMonths: m, seizureReminderDays: d });
          toast.success("Haciz süresi kaydedildi");
        }}
      >
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium">Haciz geçerlilik süresi (ay)</span>
          <Input
            type="number"
            min={1}
            max={60}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            className="w-40"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[14px] font-medium">Kaç gün önce hatırlatılsın</span>
          <Input
            type="number"
            min={1}
            max={120}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-40"
          />
        </label>
        <Button type="submit" disabled={!dirty}>
          Kaydet
        </Button>
      </form>
    </Section>
  );
}

type SectionAccess = { view: boolean; create: boolean; edit: boolean; delete: boolean };

function CategoriesTab({ access }: { access: SectionAccess }) {
  const { state, updateSettings } = useErp();
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Formlardaki açılır listeler buradan gelir. Eklediğiniz değer hemen tüm formlarda çıkar;
        sildiğiniz değer eski kayıtlarda olduğu gibi kalır. <Lock className="inline h-3.5 w-3.5" />{" "}
        işaretli değerleri program otomatik kullandığı için silinemez.
      </p>
      {CAT_GROUPS.map((g) => (
        <div key={g.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{g.title}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {g.items.map((c) => (
              <CategoryEditor
                key={c.key}
                title={c.title}
                description={c.desc}
                items={state.settings[c.key]}
                locked={c.locked}
                canEmpty={c.canEmpty}
                canAdd={access.create}
                canRemove={access.delete}
                onChange={(items) => updateSettings({ [c.key]: items } as Partial<SettingsT>)}
              />
            ))}
          </div>
          {g.title === "Dosyalar" && <ClosedCaseSettings canEdit={access.edit} />}
          {g.title === "İcra" && <SeizureSettings canEdit={access.edit} />}
        </div>
      ))}
    </div>
  );
}

function CategoryEditor({
  title,
  description,
  items,
  locked = [],
  canEmpty,
  canAdd = true,
  canRemove = true,
  onChange,
}: {
  title: string;
  description: string;
  items: string[];
  locked?: string[];
  canEmpty?: boolean;
  canAdd?: boolean;
  canRemove?: boolean;
  onChange: (v: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v) return;
    if (items.some((i) => i.toLocaleLowerCase("tr") === v.toLocaleLowerCase("tr"))) {
      toast.error("Bu değer zaten var");
      return;
    }
    onChange([...items, v]);
    setValue("");
  };
  const removeItem = (i: string) => {
    if (!canEmpty && items.length <= 1) {
      toast.error("Listede en az bir değer kalmalı");
      return;
    }
    onChange(items.filter((x) => x !== i));
  };
  return (
    <Section title={title} description={description}>
      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Henüz değer yok. Aşağıdan ekleyin.</p>
        )}
        {items.map((i) => {
          const isLocked = locked.includes(i);
          return (
            <span
              key={i}
              title={isLocked ? "Program bu değeri kullanıyor, silinemez" : undefined}
              className="group inline-flex h-7 items-center gap-1 rounded-full border border-border/80 bg-secondary/50 pl-3 pr-1.5 text-xs font-medium animate-pop"
            >
              {i}
              {isLocked ? (
                <Lock className="mx-0.5 h-3 w-3 text-muted-foreground" />
              ) : !canRemove ? (
                <span className="w-1.5" />
              ) : (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  aria-label={`${i} sil`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      {canAdd && (
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Yeni ekle..."
          className="h-9"
        />
        <Button type="submit" size="sm" variant="soft" className="h-9">
          <Plus /> Ekle
        </Button>
      </form>
      )}
    </Section>
  );
}

/* ───────────── Hesabım ───────────── */

function AccountTab() {
  const { currentUser, patch, changePassword } = useErp();
  const [profile, setProfile] = useState({
    name: currentUser.name,
    phone: currentUser.phone ?? "",
    title: currentUser.title ?? "",
  });
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Section title="Profil">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={profile.name} size="lg" />
          <div>
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">
              {currentUser.role} · @{currentUser.username}
            </p>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            patch("users", currentUser.id, {
              name: profile.name.trim(),
              phone: profile.phone || undefined,
              title: profile.title || undefined,
            });
            toast.success("Profil güncellendi");
          }}
        >
          {(["name", "title", "phone"] as const).map((k) => (
            <label key={k} className="block space-y-1.5">
              <span className="text-[14px] font-medium">
                {{ name: "Ad soyad", title: "Ünvan", phone: "Telefon" }[k]}
              </span>
              <Input
                value={profile[k]}
                onChange={(e) => setProfile((p) => ({ ...p, [k]: e.target.value }))}
              />
            </label>
          ))}
          <Button type="submit">Kaydet</Button>
        </form>
      </Section>
      <Section title="Şifre değiştir" description="En az 8 karakter. Yeni şifreniz bir sonraki girişten itibaren geçerli olur">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.next !== pw.again) {
              toast.error("Yeni şifreler eşleşmiyor");
              return;
            }
            setBusy(true);
            const res = await changePassword(pw.current, pw.next);
            setBusy(false);
            if (res.ok) {
              toast.success("Şifreniz değiştirildi");
              setPw({ current: "", next: "", again: "" });
            } else toast.error(res.error);
          }}
        >
          {(
            [
              ["current", "Mevcut şifre", "current-password"],
              ["next", "Yeni şifre", "new-password"],
              ["again", "Yeni şifre (tekrar)", "new-password"],
            ] as const
          ).map(([k, label, ac]) => (
            <label key={k} className="block space-y-1.5">
              <span className="text-[14px] font-medium">{label}</span>
              <Input
                type="password"
                autoComplete={ac}
                value={pw[k]}
                onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))}
                required
              />
            </label>
          ))}
          <Button type="submit" loading={busy}>
            <KeyRound /> Şifreyi güncelle
          </Button>
        </form>
      </Section>
    </div>
  );
}

/* ───────────── Yedekleme ───────────── */

function ArchiveSection() {
  const { state, archiveYears } = useErp();
  const confirm = useConfirm();
  const current = Number(today().slice(0, 4));
  const dated = [
    ...state.expenses.map((e) => e.date),
    ...state.transactions.map((t) => t.date),
    ...state.collections.map((c) => c.date),
    ...state.plans.map((p) => p.date),
  ];
  const minYear = dated.length ? Math.min(...dated.map((d) => Number(d.slice(0, 4)))) : current;
  const years = Array.from({ length: Math.max(0, current - minYear) }, (_, i) => current - 1 - i);
  const [year, setYear] = useState<string>(years[0] ? String(years[0]) : "");
  const c = year ? archiveCandidates(state, Number(year)) : null;
  const counts: Array<[string, number]> = c
    ? [
        ["Masraf (makbuzlarıyla)", c.expenses.length],
        ["Biten tahsilat planı", c.plans.length],
        ["Aktarılmış icra tahsilatı", c.collections.length],
        ["Kasa / banka hareketi", c.transactions.length],
        ["Biten ajanda kaydı", c.reminders.length],
        ["Sonuçlanan ödeme sözü", c.promises.length],
        ["Görüşme notu", c.contacts.length],
        ["Aktivite / bildirim", c.activities.length + c.notifications.length],
      ]
    : [];
  const total = counts.reduce((n, [, v]) => n + v, 0);
  return (
    <Section
      title="Eski yılları arşivle"
      description="Yer açmak için eski yılların ayrıntılarını siler; her yılın para toplamları kalır."
    >
      {years.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Arşivlenecek eski yıl yok. Yalnızca içinde bulunulan yıldan önceki yıllar arşivlenebilir.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">yılı ve öncesi</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.map(([label, n]) => (
              <div key={label} className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{n}</p>
              </div>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>
              <strong>Kalanlar:</strong> müvekkiller, dosyalar, icra dosyaları, borçlular, belgeler;
              her yılın tahsilat / masraf toplamları (Raporlar → Yıllık özet); kasa ve cari
              bakiyeleri.
            </li>
            <li>
              <strong>Kalmayanlar:</strong> yukarıdaki kayıtların tek tek ayrıntısı. Hâlâ ödemesi
              bekleyen taksit, aktarılmamış icra parası ve bekleyen işler silinmez.
            </li>
          </ul>
          <Button
            variant="destructive"
            disabled={!total}
            onClick={async () => {
              if (
                await confirm({
                  title: `${year} ve öncesi arşivlensin mi?`,
                  description: `${total} kayıt kalıcı olarak silinecek; yalnızca yıllık toplamlar ve bakiyeler kalacak. Geri alınamaz, önce yedek almanız önerilir.`,
                  confirmLabel: "Arşivle",
                })
              ) {
                const n = archiveYears(Number(year));
                toast.success(`${n} kayıt arşivlendi; yıllık toplamlar Raporlar'da duruyor`);
              }
            }}
          >
            <Archive /> {total ? `${total} kaydı arşivle` : "Arşivlenecek kayıt yok"}
          </Button>
        </div>
      )}
    </Section>
  );
}

function ErrorTrackingSection() {
  const [busy, setBusy] = useState(false);
  const enabled = sentryEnabled();
  return (
    <Section
      title="Hata izleme"
      description="Uygulamada oluşan hatalar geliştiriciye otomatik bildirilir (Sentry)."
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={enabled ? "green" : "slate"}>
          {enabled ? "Açık" : "Kapalı (DSN tanımlı değil)"}
        </StatusBadge>
        <Button
          size="sm"
          variant="outline"
          disabled={!enabled}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const sent = await sendSentryTest();
            setBusy(false);
            if (sent)
              toast.success("Test hatası gönderildi; Sentry panelinde birkaç saniyede görünür");
            else toast.error("Gönderilemedi (ağ ya da reklam engelleyici olabilir)");
          }}
        >
          Test hatası gönder
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Kişisel veri gönderilmez: ad, e-posta, TC / vergi no, IBAN, telefon maskelenir; istek
        içeriği ve tıklanan metinler izlenmez. Hatayı kimin aldığı yalnızca kimlik numarasıyla
        görünür.
      </p>
    </Section>
  );
}

function BackupTab() {
  const { state, replaceState, permissions } = useErp();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const counts: Array<[string, number]> = [
    ["Müvekkil", state.clients.length],
    ["Dosya", state.cases.length],
    ["Masraf", state.expenses.length],
    ["Tahsilat planı", state.plans.length],
    ["İcra dosyası", state.enforcements.length],
    ["Belge", state.documents.length],
  ];
  return (
    <div className="space-y-4">
      <Section
        title="Veri durumu"
        description="Veriler şu an bu tarayıcıda saklanıyor. Düzenli yedek almanız önerilir."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {counts.map(([label, n]) => (
            <div key={label} className="rounded-xl bg-secondary/40 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold">{n}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Veriler Supabase üzerinde tutulur; ekler Storage kovasında saklanır.
        </p>
      </Section>
      <Section title="Yedek al / geri yükle">
        <div className="flex flex-wrap gap-2">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await exportBackup(state);
                toast.success(`Yedek indirildi (${r.attachments} ek dahil)`);
                if (r.missing) toast.warning(`${r.missing} ek indirilemedi`);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download /> Yedeği indir (.zip)
          </Button>
          {permissions.manageSettings && (
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload /> Yedekten geri yükle
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept=".zip,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (
                !(await confirm({
                  title: "Yedek geri yüklensin mi?",
                  description:
                    "Sunucu aktarımı henüz otomatik değildir. Excel aktarımını veya destek sürecini kullanın.",
                  confirmLabel: "Anladım",
                }))
              )
                return;
              try {
                replaceState(await readBackup(file));
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
        </div>
      </Section>
      {permissions.manageSettings && <ArchiveSection />}
      {permissions.manageSettings && <ErrorTrackingSection />}
    </div>
  );
}
