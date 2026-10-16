/**
 * Ayarlar > İzinler: avukatların neyi görüp neyi yapabileceğini belirler.
 *
 *   1) Önce rol varsayılanı ("Tüm avukatlar") ayarlanır.
 *   2) İstenirse tek bir avukat seçilip ona özel istisna tanımlanır; rolden farklı olanlar işaretlenir.
 *
 * Admin her şeye sahiptir ve burada değiştirilemez. Kullanıcı yönetimi, ayarlar, yedek ve arşiv
 * yalnızca Admin'dedir.
 */
import { useMemo, useState } from "react";
import { Lock, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { Section } from "@/components/app/bits";
import { Avatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_LAWYER_PERMISSIONS,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_MODULES,
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
    hint: "Para ve raporlar dahil her şey (ayarlar hariç)",
    build: () => Object.fromEntries(ALL_KEYS.map((k) => [k, true])),
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
  const lawyers = state.users.filter((u) => u.role === "Avukat");
  const [scope, setScope] = useState<string>("role");
  const user = scope === "role" ? undefined : lawyers.find((u) => u.id === scope);
  const roleGrants = state.settings.rolePermissions;

  const current = useMemo(
    () => effective(roleGrants, user?.permissions),
    [roleGrants, user?.permissions],
  );
  const diffCount = user ? ALL_KEYS.filter((k) => current[k] !== !!roleGrants[k]).length : 0;

  /** Seçili kapsama (rol ya da kişi) yeni etkin izin haritasını yazar */
  const save = (next: Grants) => {
    const clean: Grants = {};
    for (const k of ALL_KEYS) clean[k] = !!next[k];
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
  };

  const toggle = (mod: PermissionModule, action: PermissionAction, on: boolean) =>
    save(applyToggle(current, mod, action, on));

  const menu = PERMISSION_MODULES.filter((m) => m.menu && current[permissionKey(m.key, "view")]);

  return (
    <div className="space-y-4">
      <Section
        title="Avukat izinleri"
        description="Bir avukatın hangi sayfaları göreceğini ve nelerde işlem yapabileceğini belirleyin. Değişiklik anında geçerli olur."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[14px] font-medium">Kimin için?</p>
            <div className="flex flex-wrap gap-2">
              <ScopeChip active={scope === "role"} onClick={() => setScope("role")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Tüm avukatlar (varsayılan)
              </ScopeChip>
              {lawyers.map((u) => (
                <ScopeChip key={u.id} active={scope === u.id} onClick={() => setScope(u.id)}>
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
                    toast.success(`"${p.label}" uygulandı`);
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
                    patch("users", user.id, { permissions: undefined });
                    toast.success("Kişisel istisnalar kaldırıldı");
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
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,3.4rem)] items-center gap-x-1 border-b border-border/60 bg-muted/40 px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] sm:px-5 sm:text-xs">
          <span>Alan</span>
          {PERMISSION_ACTIONS.map((a) => (
            <span key={a} className="text-center">
              {PERMISSION_ACTION_LABELS[a]}
            </span>
          ))}
        </div>
        <ul className="divide-y divide-border/60">
          {PERMISSION_MODULES.map((m) => (
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
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Admin</strong> her şeyi görür ve yapar. Kullanıcı yönetimi, ayarlar, yedekleme
            ve eski yılları arşivleme yalnızca Admin'dedir; bu izinler verilemez.
          </span>
        </p>
      </Section>
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
