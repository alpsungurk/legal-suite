/**
 * Ayarlar > İzinler: avukatların neyi görüp neyi yapabileceğini belirler.
 *
 *   1) Önce rol varsayılanı ("Tüm avukatlar") ayarlanır.
 *   2) İstenirse tek bir avukat seçilip ona özel istisna tanımlanır; rolden farklı olanlar işaretlenir.
 *
 * Admin her şeye sahiptir ve burada değiştirilemez. Ayarlar sayfasının bazı bölümleri (büro bilgileri,
 * kategoriler, şirket listeleri, kullanıcı listesi, yedek indirme) tek tek verilebilir; izinler, kullanıcı
 * yönetimi, zamanlama ve arşiv yalnızca Admin'dedir.
 */
import { useEffect, useMemo, useState } from "react";
import { Lock, RotateCcw, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { useConfirm } from "@/components/app/confirm";
import { Section } from "@/components/app/bits";
import { Avatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_LAWYER_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_MODULES,
  SETTINGS_PERMISSION_KEYS,
  permissionKey,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/erp-types";
import { cn } from "@/lib/utils";

type Grants = Record<string, boolean>;

const ALL_KEYS = PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => permissionKey(m.key, a)));

/** Değiştirilen izne göre bağlı izinleri de düzeltir (ör. Düzenle açılınca Görüntüle de açılır) */
function applyToggle(
  grants: Grants,
  mod: PermissionModule,
  action: PermissionAction,
  on: boolean,
): Grants {
  const next = { ...grants, [permissionKey(mod.key, action)]: on };
  if (mod.coupled) {
    if (on && action !== "view") next[permissionKey(mod.key, "view")] = true;
    if (!on && action === "view")
      for (const a of mod.actions) next[permissionKey(mod.key, a)] = false;
  }
  return next;
}

const PRESETS: Array<{ id: string; label: string; hint: string; build: () => Grants }> = [
  {
    id: "readonly",
    label: "Sadece görüntüleme",
    hint: "Müvekkil, dosya, belge ve icrayı görür; hiçbir şeyi değiştirmez",
    build: () => {
      const g: Grants = {};
      for (const k of ["clients", "cases", "documents", "enforcements"] as const)
        g[permissionKey(k, "view")] = true;
      return g;
    },
  },
  {
    id: "standard",
    label: "Standart avukat",
    hint: "İlk kurulumdaki varsayılan",
    build: () => ({ ...DEFAULT_LAWYER_PERMISSIONS }),
  },
  {
    id: "full",
    label: "Tam yetki",
    hint: "Para ve raporlar dahil her şey (Ayarlar bölümleri hariç)",
    // Ayarlar bölümleri bilerek hariç: onlar ayrıca, tek tek verilir
    build: () =>
      Object.fromEntries(
        PERMISSION_MODULES.filter((m) => m.group !== "settings").flatMap((m) =>
          m.actions.map((a) => [permissionKey(m.key, a), true]),
        ),
      ),
  },
  {
    id: "none",
    label: "Hepsini kapat",
    hint: "Yalnızca kendi masrafını ve görevlerini görür",
    build: () => ({}),
  },
];

/** Rol varsayılanını (tam harita) ve kişisel istisnayı birleştirip etkin haritayı verir */
function effective(role: Grants, overrides?: Grants): Grants {
  const out: Grants = {};
  for (const k of ALL_KEYS) out[k] = overrides?.[k] ?? role[k] ?? false;
  return out;
}

export function PermissionsTab() {
  const { state, patch, updateSettings } = useErp();
  const confirm = useConfirm();
  const lawyers = state.users.filter((u) => u.role === "Avukat");
  const [scope, setScope] = useState<string>("role");
  const user = scope === "role" ? undefined : lawyers.find((u) => u.id === scope);
  const roleGrants = state.settings.rolePermissions;

  const saved = useMemo(
    () => effective(roleGrants, user?.permissions),
    [roleGrants, user?.permissions],
  );
  // Değişiklikler önce taslakta tutulur; "Kaydet"e basılınca yazılır
  const [draft, setDraft] = useState<Grants | null>(null);
  const current = draft ?? saved;
  const pending = draft ? ALL_KEYS.filter((k) => !!draft[k] !== saved[k]).length : 0;
  const diffCount = user ? ALL_KEYS.filter((k) => current[k] !== !!roleGrants[k]).length : 0;

  // Kaydedilmemiş değişiklik varken sayfa kapatılırsa tarayıcı uyarır
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const save = (next: Grants) => setDraft(next);

  /** Taslağı seçili kapsama (rol ya da kişi) yazar */
  const commit = () => {
    if (!draft) return;
    const clean: Grants = {};
    for (const k of ALL_KEYS) clean[k] = !!draft[k];
    if (!user) {
      updateSettings({ rolePermissions: clean });
    } else {
      // Kişide yalnızca rolden farklı olanlar saklanır
      const overrides: Grants = {};
      for (const k of ALL_KEYS) if (clean[k] !== !!roleGrants[k]) overrides[k] = clean[k];
      patch("users", user.id, {
        permissions: Object.keys(overrides).length ? overrides : undefined,
      });
    }
    setDraft(null);
    toast.success(user ? `${user.name} için izinler kaydedildi` : "Avukat izinleri kaydedildi");
  };

  const discard = () => {
    setDraft(null);
    setSettingsShown(
      settingsModules.some((m) => m.actions.some((a) => saved[permissionKey(m.key, a)])),
    );
  };

  /** Kaydedilmemiş değişiklik varken başka avukata / role geçmeden önce sorar */
  const changeScope = async (next: string) => {
    if (next === scope) return;
    if (
      pending &&
      !(await confirm({
        title: "Kaydedilmemiş değişiklikler var",
        description: `${pending} izin değişikliği kaydedilmedi. Kaydetmeden geçilirse kaybolur.`,
        confirmLabel: "Kaydetmeden geç",
      }))
    )
      return;
    setDraft(null);
    setScope(next);
  };

  const toggle = (mod: PermissionModule, action: PermissionAction, on: boolean) =>
    save(applyToggle(current, mod, action, on));

  const menu = PERMISSION_MODULES.filter((m) => m.menu && current[permissionKey(m.key, "view")]);
  const mainModules = PERMISSION_MODULES.filter((m) => m.group !== "settings");
  const settingsModules = PERMISSION_MODULES.filter((m) => m.group === "settings");
  const settingsOpen = SETTINGS_PERMISSION_KEYS.filter((k) => current[permissionKey(k, "view")]);
  // "Ayarlar sayfası" ana anahtarı: kapalıyken tablo gizlenir ve avukat Ayarlar'ı hiç görmez
  const anySettings = settingsModules.some((m) =>
    m.actions.some((a) => current[permissionKey(m.key, a)]),
  );
  const [settingsShown, setSettingsShown] = useState(anySettings);
  // Kapsam (tüm avukatlar / tek avukat) değişince anahtar o kapsamın durumuna döner
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setSettingsShown(anySettings), [scope]);
  const toggleSettingsPage = (on: boolean) => {
    setSettingsShown(on);
    if (on) {
      if (!anySettings) toast.info("Aşağıdan avukatın göreceği bölümleri seçin");
      return;
    }
    if (!anySettings) return;
    const next = { ...current };
    for (const m of settingsModules)
      for (const a of m.actions) next[permissionKey(m.key, a)] = false;
    save(next);
    toast.info("Ayarlar sayfası kapatılacak; Kaydet'e basın");
  };

  return (
    <div className="space-y-4">
      <Section
        title="Avukat izinleri"
        description="Bir avukatın hangi sayfaları göreceğini ve nelerde işlem yapabileceğini belirleyin. Değişiklikler “Kaydet”e basınca geçerli olur."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[14px] font-medium">Kimin için?</p>
            <div className="flex flex-wrap gap-2">
              <ScopeChip active={scope === "role"} onClick={() => void changeScope("role")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Tüm avukatlar (varsayılan)
              </ScopeChip>
              {lawyers.map((u) => (
                <ScopeChip
                  key={u.id}
                  active={scope === u.id}
                  onClick={() => void changeScope(u.id)}
                >
                  <Avatar name={u.name} size="xs" />
                  {u.name}
                  {u.permissions && Object.keys(u.permissions).length > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 text-[12px] font-semibold text-white">
                      özel
                    </span>
                  )}
                </ScopeChip>
              ))}
            </div>
            {lawyers.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Henüz avukat yok. Ayarlar → Kullanıcılar'dan ekleyebilirsiniz; varsayılan izinler
                yeni eklenenlere uygulanır.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {user
                ? `${user.name} için rolden farklı ${diffCount} izin var. Diğerleri "Tüm avukatlar" ayarını izler.`
                : "Bu ayar, özel izni olmayan bütün avukatlara uygulanır."}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[14px] font-medium">Hazır ayarlar</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  title={p.hint}
                  onClick={() => {
                    save(p.build());
                    toast.info(`"${p.label}" seçildi; Kaydet'e basın`);
                  }}
                >
                  {p.label}
                </Button>
              ))}
              {user && diffCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    save(effective(roleGrants));
                    toast.info("Rolün varsayılanı seçildi; Kaydet'e basın");
                  }}
                >
                  <RotateCcw /> Rolün varsayılanına dön
                </Button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section title="İzin tablosu" bodyClassName="p-0">
        <PermTable
          mods={mainModules}
          current={current}
          roleGrants={roleGrants}
          user={user}
          toggle={toggle}
        />
      </Section>

      <Section
        title="Ayarlar sayfası"
        description="Avukata Ayarlar sayfasının yalnızca seçtiğiniz bölümleri açılır. Her bölümde görme, ekleme, düzenleme ve silmeyi ayrı ayrı verebilirsiniz."
        bodyClassName="p-0"
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
            {settingsShown ? "Açık" : "Kapalı"}
            <Switch
              checked={settingsShown}
              onCheckedChange={toggleSettingsPage}
              aria-label="Ayarlar sayfasını avukata aç / kapat"
            />
          </label>
        }
      >
        {!settingsShown ? (
          <p className="px-3 py-4 text-sm text-muted-foreground sm:px-5">
            Kapalı: avukat Ayarlar sayfasını görmez; menüde de çıkmaz. Yalnızca kendi hesabını
            (Hesabım) düzenleyebilir. Açmak için sağdaki anahtara basın.
          </p>
        ) : (
          <>
            <PermTable
              mods={settingsModules}
              current={current}
              roleGrants={roleGrants}
              user={user}
              toggle={toggle}
            />
            <p className="flex items-start gap-2 border-t border-border/60 px-3 py-3 text-xs text-muted-foreground sm:px-5">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Yalnızca Admin'de kalanlar:</strong> İzinler sekmesi, Admin hesaplarını
                yönetme, Zamanlama ve eski yılları arşivleme. "Kullanıcılar" izni verilse bile
                avukat kimseyi Admin yapamaz, izin veremez ve Admin hesaplarına dokunamaz.
              </span>
            </p>
          </>
        )}
      </Section>

      <Section
        title={user ? `${user.name} yan menüde şunları görür` : "Avukat yan menüde şunları görür"}
        description="Görüntüle izni olan sayfalar menüde çıkar; olmayanlar gizlenir ve adresle de açılmaz."
      >
        <div className="flex flex-wrap gap-2">
          <MenuChip>Gösterge paneli</MenuChip>
          <MenuChip>Ajanda</MenuChip>
          {(current["expenses.view"] || current["expenses.create"]) && (
            <MenuChip>Masraflar</MenuChip>
          )}
          {menu
            .filter((m) => m.key !== "expenses")
            .map((m) => (
              <MenuChip key={m.key}>{m.menu}</MenuChip>
            ))}
          <MenuChip>Bildirimler</MenuChip>
          {settingsOpen.length > 0 && (
            <MenuChip>
              Ayarlar (
              {settingsOpen
                .map((k) => PERMISSION_MODULES.find((m) => m.key === k)?.label.split(" (")[0])
                .join(", ")}
              )
            </MenuChip>
          )}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Admin</strong> her şeyi görür ve yapar. İzinler, kullanıcı yönetimi, zamanlama
            ve eski yılları arşivleme yalnızca Admin'dedir; bu izinler verilemez.
          </span>
        </p>
      </Section>

      <div
        className={cn(
          "sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 shadow-soft",
          pending ? "border-amber-400/70" : "border-border",
        )}
      >
        <p className="text-sm">
          {pending ? (
            <span className="font-medium text-amber-700 dark:text-amber-300">
              {pending} kaydedilmemiş değişiklik
              {user ? ` · ${user.name}` : " · Tüm avukatlar"}
            </span>
          ) : (
            <span className="text-muted-foreground">Kaydedilmemiş değişiklik yok</span>
          )}
        </p>
        <div className="flex gap-2">
          {pending > 0 && (
            <Button size="sm" variant="ghost" onClick={discard}>
              <RotateCcw /> Vazgeç
            </Button>
          )}
          <Button size="sm" disabled={!pending} onClick={commit}>
            <Save /> Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function MenuChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/80 bg-secondary/50 px-3 text-xs font-medium">
      <UserRound className="h-3 w-3 text-muted-foreground" />
      {children}
    </span>
  );
}

/** İzin tablosu: her satır bir alan, sağda Görüntüle / Ekle / Düzenle / Sil anahtarları */
function PermTable({
  mods,
  current,
  roleGrants,
  user,
  toggle,
}: {
  mods: PermissionModule[];
  current: Grants;
  roleGrants: Grants;
  user?: { id: string; name: string } | undefined;
  toggle: (mod: PermissionModule, action: PermissionAction, on: boolean) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,3.4rem)] items-center gap-x-1 border-b border-border/60 bg-muted/40 px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] sm:px-5 sm:text-xs">
        <span>Alan</span>
        {PERMISSION_ACTIONS.map((a) => (
          <span key={a} className="text-center">
            {PERMISSION_ACTION_LABELS[a]}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-border/60">
        {mods.map((m) => (
          <li
            key={m.key}
            className="grid grid-cols-[minmax(0,1fr)_repeat(4,3.4rem)] items-center gap-x-1 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] sm:px-5"
          >
            <div className="min-w-0 pr-2">
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-[12.5px] leading-snug text-muted-foreground">{m.hint}</p>
            </div>
            {PERMISSION_ACTIONS.map((a) => {
              if (!m.actions.includes(a)) {
                return (
                  <span key={a} className="text-center text-muted-foreground/40">
                    —
                  </span>
                );
              }
              const key = permissionKey(m.key, a);
              const on = !!current[key];
              const changed = !!user && on !== !!roleGrants[key];
              return (
                <span key={a} className="relative flex justify-center">
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => toggle(m, a, v)}
                    aria-label={`${m.label}: ${PERMISSION_ACTION_LABELS[a]}${m.actionHints?.[a] ? ` (${m.actionHints[a]})` : ""}`}
                    title={m.actionHints?.[a]}
                  />
                  {changed && (
                    <span
                      className="absolute -right-0.5 -top-1 h-2 w-2 rounded-full bg-amber-500"
                      title="Rolün varsayılanından farklı"
                    />
                  )}
                </span>
              );
            })}
            {PERMISSION_ACTIONS.some((a) => m.actionHints?.[a]) && (
              <ul className="col-span-full mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted-foreground">
                {PERMISSION_ACTIONS.filter((a) => m.actionHints?.[a]).map((a) => (
                  <li key={a}>
                    <span className="font-medium">{PERMISSION_ACTION_LABELS[a]}:</span>{" "}
                    {m.actionHints?.[a]}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
