import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  DatabaseBackup,
  Download,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
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
import type { FirmProfile, Settings as SettingsT, User } from "@/lib/erp-types";
import { exportBackup, readBackup } from "@/lib/backup";
import { formatBytes, formatIban } from "@/lib/format";
import { STORAGE_KEY } from "@/lib/migrations";

type Search = { sekme?: string };

export const Route = createFileRoute("/ayarlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    sekme: typeof s.sekme === "string" ? s.sekme : undefined,
  }),
  head: () => ({ meta: [{ title: "Ayarlar — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { permissions } = useErp();
  const navigate = useNavigate();
  const { sekme } = Route.useSearch();
  const tab = sekme ?? (permissions.manageSettings ? "buro" : "hesabim");
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
            {permissions.manageSettings && (
              <TabsTrigger value="buro">
                <Building2 className="mr-1.5 h-4 w-4" /> Büro
              </TabsTrigger>
            )}
            {permissions.manageUsers && (
              <TabsTrigger value="kullanicilar">
                <Users className="mr-1.5 h-4 w-4" /> Kullanıcılar
              </TabsTrigger>
            )}
            {permissions.manageSettings && (
              <TabsTrigger value="kategoriler">
                <Tags className="mr-1.5 h-4 w-4" /> Kategoriler
              </TabsTrigger>
            )}
            <TabsTrigger value="hesabim">
              <UserCog className="mr-1.5 h-4 w-4" /> Hesabım
            </TabsTrigger>
            {permissions.manageSettings && (
              <TabsTrigger value="yedek">
                <DatabaseBackup className="mr-1.5 h-4 w-4" /> Yedekleme
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="buro" className="mt-4">
          <FirmTab />
        </TabsContent>
        <TabsContent value="kullanicilar" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="kategoriler" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="hesabim" className="mt-4">
          <AccountTab />
        </TabsContent>
        <TabsContent value="yedek" className="mt-4">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

/* ───────────── Büro ───────────── */

function FirmTab() {
  const { state, updateSettings } = useErp();
  const [firm, setFirm] = useState<FirmProfile>(state.settings.firm);
  useEffect(() => setFirm(state.settings.firm), [state.settings.firm]);
  const dirty = JSON.stringify(firm) !== JSON.stringify(state.settings.firm);
  const field = (
    key: keyof FirmProfile,
    label: string,
    opts?: { placeholder?: string; span?: boolean },
  ) => (
    <label className={opts?.span ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="text-[13px] font-medium">{label}</span>
      <Input
        value={(firm[key] as string) ?? ""}
        placeholder={opts?.placeholder}
        onChange={(e) => setFirm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </label>
  );
  return (
    <div className="space-y-4">
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
            <span className="text-[13px] font-medium">Ekstre alt notu</span>
            <Textarea
              value={firm.statementNote}
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
            onRemove={() => setFirm((f) => ({ ...f, logo: undefined }))}
          />
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
      <div className="sticky bottom-4 z-10 flex justify-end">
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

function UsersTab() {
  const { state, currentUser, remove, patch } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
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
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
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
      cell: (u) =>
        u.role === "Müvekkil" ? (
          <StatusBadge tone="cyan">Müvekkil · {clientName(u.clientId)}</StatusBadge>
        ) : (
          <StatusBadge status={u.role} />
        ),
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
      description="Ekip üyeleri ve müvekkil portalı hesapları"
      actions={
        <Button size="sm" onClick={() => quick.open("user")}>
          <Plus /> Kullanıcı ekle
        </Button>
      }
      bodyClassName="p-0"
    >
      <DataTable
        className="rounded-none border-0 shadow-none"
        rows={state.users}
        columns={columns}
        getId={(u) => u.id}
        searchText={(u) => [u.name, u.username, u.email]}
        filters={[
          {
            id: "role",
            label: "Rol",
            options: ["Admin", "Avukat", "Sekreter", "Müvekkil"],
            get: (u) => u.role,
          },
        ]}
        exportName="Kullanıcılar"
        onRowClick={(u) => quick.open("user", { record: u })}
        rowActions={(u) => (
          <>
            <DropdownMenuItem onClick={() => quick.open("user", { record: u })}>
              <Pencil /> Düzenle / şifre
            </DropdownMenuItem>
            {u.id !== currentUser.id && (
              <>
                <DropdownMenuItem onClick={() => patch("users", u.id, { active: !u.active })}>
                  <KeyRound /> {u.active ? "Devre dışı bırak" : "Etkinleştir"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `${u.name} silinsin mi?`,
                        description: "Kullanıcının geçmiş kayıtları korunur.",
                      })
                    ) {
                      remove("users", u.id);
                      toast.success("Kullanıcı silindi");
                    }
                  }}
                >
                  <Trash2 /> Sil
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

const CATS: Array<{
  key: keyof Pick<SettingsT, "caseTypes" | "expenseTypes" | "reminderTypes" | "documentCategories">;
  title: string;
  desc: string;
}> = [
  { key: "expenseTypes", title: "Masraf türleri", desc: "Harç, bilirkişi, tebligat..." },
  { key: "caseTypes", title: "Dosya türleri", desc: "Dava, icra, danışmanlık..." },
  { key: "reminderTypes", title: "Ajanda türleri", desc: "Duruşma, süre sonu, toplantı..." },
  {
    key: "documentCategories",
    title: "Belge kategorileri",
    desc: "Dilekçe, karar, vekaletname...",
  },
];

function CategoriesTab() {
  const { state, updateSettings } = useErp();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {CATS.map((c) => (
        <CategoryEditor
          key={c.key}
          title={c.title}
          description={c.desc}
          items={state.settings[c.key]}
          onChange={(items) => updateSettings({ [c.key]: items } as Partial<SettingsT>)}
        />
      ))}
    </div>
  );
}

function CategoryEditor({
  title,
  description,
  items,
  onChange,
}: {
  title: string;
  description: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v) return;
    if (items.some((i) => i.toLocaleLowerCase("tr") === v.toLocaleLowerCase("tr"))) {
      toast.error("Bu kategori zaten var");
      return;
    }
    onChange([...items, v]);
    setValue("");
  };
  return (
    <Section title={title} description={description}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span
            key={i}
            className="group inline-flex h-7 items-center gap-1 rounded-full border border-border/80 bg-secondary/50 pl-3 pr-1.5 text-xs font-medium animate-pop"
          >
            {i}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== i))}
              className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
              aria-label={`${i} sil`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
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
    </Section>
  );
}

/* ───────────── Hesabım ───────────── */

function AccountTab() {
  const { currentUser, patch, changePassword } = useErp();
  const [profile, setProfile] = useState({
    name: currentUser.name,
    email: currentUser.email,
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
              email: profile.email.trim(),
              phone: profile.phone || undefined,
              title: profile.title || undefined,
            });
            toast.success("Profil güncellendi");
          }}
        >
          {(["name", "title", "email", "phone"] as const).map((k) => (
            <label key={k} className="block space-y-1.5">
              <span className="text-[13px] font-medium">
                {{ name: "Ad soyad", title: "Ünvan", email: "E-posta", phone: "Telefon" }[k]}
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
      <Section title="Şifre değiştir" description="En az 6 karakter">
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
              <span className="text-[13px] font-medium">{label}</span>
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

function BackupTab() {
  const { state, replaceState, resetDemo } = useErp();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const size = (() => {
    try {
      return (localStorage.getItem(STORAGE_KEY)?.length ?? 0) * 2;
    } catch {
      return 0;
    }
  })();
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
          Kayıt verisi: {formatBytes(size)} (ekler ayrıca tarayıcı veritabanında tutulur)
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
                if (r.missing) toast.warning(`${r.missing} ek bu cihazda bulunamadı`);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download /> Yedeği indir (.zip)
          </Button>
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload /> Yedekten geri yükle
          </Button>
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
                  description: "Mevcut tüm veriler yedekteki verilerle değiştirilecek.",
                  confirmLabel: "Geri yükle",
                }))
              )
                return;
              try {
                replaceState(await readBackup(file));
                toast.success("Yedek geri yüklendi");
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          />
        </div>
      </Section>
      <Section
        title="Demo verisine dön"
        description="Tüm kayıtları silip örnek veriyle yeniden başlar."
      >
        <Button
          variant="destructive"
          onClick={async () => {
            if (
              await confirm({
                title: "Tüm veriler silinsin mi?",
                description: "Bu işlem geri alınamaz. Önce yedek almanız önerilir.",
                confirmLabel: "Sıfırla",
              })
            ) {
              resetDemo();
              toast.success("Demo verisi yüklendi");
            }
          }}
        >
          <RotateCcw /> Sıfırla
        </Button>
      </Section>
    </div>
  );
}
