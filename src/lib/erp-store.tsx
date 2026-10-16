import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { emptyState } from "@/lib/erp-data";
import {
  type ActivityLog,
  type AppNotification,
  type CollectionKey,
  type Collections,
  type ErpState,
  type InstallmentPayment,
  type Permissions,
  permissionsFor,
  type Settings,
  type User,
} from "@/lib/erp-types";
import { caseLabel } from "@/lib/finance";
import { formatMoney, round2, sum, today } from "@/lib/format";
import { passwordProblem } from "@/lib/auth";
import { newId } from "@/lib/mappers";
import { setSentryContext } from "@/lib/sentry";
import { setRemember, supabase, supabaseConfigured } from "@/lib/supabase";
import {
  blankState,
  loadFullState,
  persistOrgName,
  persistRemove,
  persistSave,
  persistSettings,
} from "@/lib/supabase-data";
import type { Organization } from "@/lib/tenants";

const IDLE_LIMIT_MS = 8 * 60 * 60 * 1000;
const GUARD_KEY = "lexkasa-login-guard-v1";

const GUEST_USER: User = {
  id: "guest",
  firmId: "",
  createdAt: "",
  updatedAt: "",
  name: "",
  role: "Avukat",
  email: "",
  username: "",
  active: false,
  passwordHash: "",
  passwordSalt: "",
  permissions: {},
};

type Guard = { fails: number; until: number };

function readGuard(): Guard {
  try {
    return { fails: 0, until: 0, ...JSON.parse(localStorage.getItem(GUARD_KEY) ?? "{}") };
  } catch {
    return { fails: 0, until: 0 };
  }
}

function loginLockSeconds() {
  return Math.max(0, Math.ceil((readGuard().until - Date.now()) / 1000));
}

function loginFailed() {
  const g = readGuard();
  const fails = g.fails + 1;
  const wait = fails >= 5 ? Math.min(30 * 2 ** (fails - 5), 900) : 0;
  try {
    localStorage.setItem(
      GUARD_KEY,
      JSON.stringify({ fails, until: wait ? Date.now() + wait * 1000 : 0 }),
    );
  } catch {
    /* yoksay */
  }
  return wait;
}

function loginSucceeded() {
  try {
    localStorage.removeItem(GUARD_KEY);
  } catch {
    /* yoksay */
  }
}

function formatWait(seconds: number) {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} dakika` : `${seconds} saniye`;
}

/** UUID üretir (eski prefix'li id'ler kalkmıştır) */
export function uid(_prefix?: string) {
  return newId();
}

type EntityMeta = {
  label: string;
  audit: boolean;
  describe: (item: never, s: ErpState) => string;
};

const money = (n?: number) => (n == null ? "" : formatMoney(n));
const clientName = (s: ErpState, id?: string) => s.clients.find((c) => c.id === id)?.name ?? "";
const debtorName = (s: ErpState, debtorId?: string) =>
  s.debtors.find((d) => d.id === debtorId)?.name ?? "";

const ENTITY: { [K in CollectionKey]: EntityMeta } = {
  users: {
    label: "Kullanıcı",
    audit: true,
    describe: (u: Collections["users"]) => `${u.name} (${u.role})`,
  },
  clients: { label: "Müvekkil", audit: true, describe: (c: Collections["clients"]) => c.name },
  cases: {
    label: "Dosya",
    audit: true,
    describe: (c: Collections["cases"]) => caseLabel(c),
  },
  expenses: {
    label: "Masraf",
    audit: true,
    describe: (e: Collections["expenses"]) => `${e.title} · ${money(e.amount)}`,
  },
  plans: {
    label: "Tahsilat planı",
    audit: true,
    describe: (p: Collections["plans"], s) =>
      `${p.title} · ${clientName(s, p.clientId)} · ${money(p.total)}`,
  },
  accounts: { label: "Hesap", audit: true, describe: (a: Collections["accounts"]) => a.name },
  transactions: {
    label: "Hesap hareketi",
    audit: true,
    describe: (t: Collections["transactions"]) => `${t.description} · ${money(t.amount)}`,
  },
  reminders: {
    label: "Ajanda",
    audit: true,
    describe: (r: Collections["reminders"]) => `${r.type} · ${r.title}`,
  },
  debtors: { label: "Borçlu", audit: true, describe: (d: Collections["debtors"]) => d.name },
  enforcements: {
    label: "İcra dosyası",
    audit: true,
    describe: (e: Collections["enforcements"]) => `${e.no} · ${e.office}`,
  },
  promises: {
    label: "Ödeme sözü",
    audit: true,
    describe: (p: Collections["promises"]) => `${money(p.amount)} · ${p.dueDate}`,
  },
  collections: {
    label: "İcra tahsilatı",
    audit: true,
    describe: (c: Collections["collections"]) => money(c.amount),
  },
  contacts: {
    label: "Görüşme notu",
    audit: false,
    describe: (c: Collections["contacts"]) => c.channel,
  },
  documents: {
    label: "Belge",
    audit: true,
    describe: (d: Collections["documents"]) => d.name,
  },
  notifications: { label: "Bildirim", audit: false, describe: () => "" },
  activities: { label: "Aktivite", audit: false, describe: () => "" },
};

export function entityLabel(key: CollectionKey) {
  return ENTITY[key].label;
}

export type Draft<K extends CollectionKey> = Omit<
  Collections[K],
  "id" | "firmId" | "createdAt" | "updatedAt"
> & { id?: string };

type SaveOptions = {
  notify?: { userIds: string[]; title: string; link?: string };
  silent?: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export type ImportBatch = { [K in CollectionKey]?: Draft<K>[] };

export type RegisterInput = {
  firmName: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
};

type ErpContextValue = {
  state: ErpState;
  hydrated: boolean;
  /** Sunucudan veri çekilirken true (giriş sonrası / yenileme) */
  loading: boolean;
  isAuthenticated: boolean;
  organization: Organization;
  currentUser: User;
  permissions: Permissions;
  login: (username: string, password: string, remember?: boolean) => Promise<Result>;
  logout: () => void;
  registerOrganization: (input: RegisterInput) => Promise<Result>;
  isUsernameAvailable: (username: string, exceptUserId?: string) => boolean;
  changePassword: (current: string, next: string) => Promise<Result>;
  /** Yönetici geçici şifre verdiyse true: kullanıcı yeni şifre belirleyene kadar panel açılmaz */
  mustChangePassword: boolean;
  setFirstPassword: (next: string) => Promise<Result>;
  setUserPassword: (userId: string, next: string) => Promise<Result>;
  requestPasswordReset: (emailOrUsername: string) => Promise<Result>;
  save: <K extends CollectionKey>(key: K, data: Draft<K>, opts?: SaveOptions) => Collections[K];
  patch: <K extends CollectionKey>(
    key: K,
    id: string,
    changes: Partial<Collections[K]>,
    opts?: SaveOptions,
  ) => void;
  remove: <K extends CollectionKey>(key: K, id: string) => void;
  removeMany: <K extends CollectionKey>(key: K, ids: string[]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  rememberOption: (key: "courts" | "enforcementOffices", value?: string) => void;
  recordInstallmentPayment: (
    planId: string,
    installmentId: string,
    payment: Omit<InstallmentPayment, "id">,
  ) => void;
  removeInstallmentPayment: (planId: string, paymentId: string) => void;
  createTransfer: (t: {
    fromId: string;
    toId: string;
    amount: number;
    date: string;
    description: string;
  }) => void;
  accrueMonthlyFees: (period: string) => number;
  closeCase: (caseId: string) => void;
  archiveYears: (throughYear: number) => number;
  createDebtorPlan: (p: {
    enforcementId: string;
    debtorId: string;
    rows: { dueDate: string; amount: number }[];
    note?: string;
  }) => void;
  markNotificationsRead: (ids?: string[]) => void;
  notifyUsers: (
    userIds: string[],
    n: { title: string; detail: string; type: string; link?: string },
  ) => void;
  importRecords: (batch: ImportBatch, label: string) => number;
  replaceState: (next: ErpState) => void;
  resetDemo: () => void;
  reloadFromServer: () => Promise<unknown>;
  get: <K extends CollectionKey>(key: K, id?: string) => Collections[K] | undefined;
  staff: User[];
  lawyers: User[];
};

const ErpContext = createContext<ErpContextValue | null>(null);

function sbError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as Error).message);
  return String(e);
}

export function ErpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErpState>(blankState);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization>({
    id: "",
    name: "",
    createdAt: "",
    active: true,
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const loginPasswordRef = useRef("");
  const [lastActivity, setLastActivity] = useState(Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;

  const reloadFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadFullState();
      if (!loaded) {
        setState(emptyState());
        setSessionUserId(null);
        setOrganization({ id: "", name: "", createdAt: "", active: true });
        return null;
      }
      setState(loaded.state);
      setOrganization(loaded.organization);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSessionUserId(user?.id ?? null);
      setMustChangePassword(user?.user_metadata?.must_change_password === true);
      return loaded;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured()) {
        console.warn("Supabase yapılandırılmamış");
        setHydrated(true);
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user && !cancelled) {
          await reloadFromServer();
        }
      } catch (err) {
        console.error("Oturum yüklenemedi", err);
        toast.error("Veriler yüklenemedi");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        setSessionUserId(null);
        setMustChangePassword(false);
        setState(emptyState());
        setOrganization({ id: "", name: "", createdAt: "", active: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "PASSWORD_RECOVERY") {
        try {
          await reloadFromServer();
        } catch (err) {
          console.error(err);
        }
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [reloadFromServer]);

  const currentUser = useMemo(() => {
    if (!sessionUserId) return GUEST_USER;
    return state.users.find((u) => u.id === sessionUserId && u.active) ?? GUEST_USER;
  }, [state.users, sessionUserId]);

  const isAuthenticated = !!sessionUserId && currentUser.id !== "guest" && currentUser.active;
  const permissions = useMemo(
    () => permissionsFor(currentUser.role, state.settings.rolePermissions, currentUser.permissions),
    [currentUser.role, currentUser.permissions, state.settings.rolePermissions],
  );
  const currentUserId = currentUser.id;

  useEffect(() => {
    setSentryContext(
      isAuthenticated
        ? { orgId: state.firmId, userId: currentUser.id, role: currentUser.role }
        : null,
    );
  }, [isAuthenticated, state.firmId, currentUser.id, currentUser.role]);

  /* Idle logout */
  useEffect(() => {
    if (!isAuthenticated) return;
    const touch = () => setLastActivity(Date.now());
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity > IDLE_LIMIT_MS) {
        void supabase.auth.signOut();
        toast.info("Uzun süre işlem yapılmadığı için oturumunuz kapatıldı.");
      }
    }, 60_000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, [isAuthenticated, lastActivity]);

  const buildNotifications = useCallback(
    async (
      userIds: string[],
      n: { title: string; detail: string; type: string; link?: string },
    ) => {
      const targets = [...new Set(userIds)].filter((id) => id && id !== currentUserId);
      if (!targets.length) return;
      const rows = targets.map((user_id) => ({
        id: newId(),
        user_id,
        title: n.title,
        detail: n.detail,
        type: n.type,
        link: n.link || null,
        read: false,
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) {
        console.error(error);
        return;
      }
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        notifications: [
          ...rows.map(
            (r): AppNotification => ({
              id: r.id,
              firmId: prev.firmId,
              createdAt: now,
              updatedAt: now,
              userId: r.user_id,
              title: r.title,
              detail: r.detail,
              type: r.type,
              link: n.link,
              read: false,
            }),
          ),
          ...prev.notifications,
        ].slice(0, 500),
      }));
    },
    [currentUserId],
  );

  /* ───────────── CRUD ───────────── */

  const save = useCallback(
    <K extends CollectionKey>(key: K, data: Draft<K>, opts?: SaveOptions): Collections[K] => {
      if (key === "activities") {
        throw new Error("Aktivite kayıtları sunucu tarafından tutulur");
      }
      if (key === "users" && !data.id) {
        throw new Error("Yeni kullanıcı davet ile eklenir (Ayarlar → Kullanıcılar)");
      }

      const now = new Date().toISOString();
      const existingNow = data.id
        ? (stateRef.current[key] as Collections[K][]).find((r) => r.id === data.id)
        : undefined;
      const id = data.id ?? newId();

      // plans: installments id'siz gelirse üret
      let normalized = { ...data, id } as Draft<K>;
      if (key === "plans") {
        const plan = normalized as unknown as Draft<"plans">;
        plan.installments = (plan.installments ?? []).map((inst) => ({
          ...inst,
          id: inst.id || newId(),
          payments: (inst.payments ?? []).map((p) => ({ ...p, id: p.id || newId() })),
        }));
        normalized = plan as unknown as Draft<K>;
      }

      const item = {
        ...(existingNow ?? {}),
        ...normalized,
        id,
        firmId: stateRef.current.firmId,
        createdAt: existingNow?.createdAt ?? now,
        updatedAt: now,
      } as Collections[K];

      setState((prev) => {
        const list = prev[key] as Collections[K][];
        const before = list.find((r) => r.id === id);
        const merged = {
          ...(before ?? {}),
          ...item,
          createdAt: before?.createdAt ?? now,
        } as Collections[K];
        const nextList = before ? list.map((r) => (r.id === id ? merged : r)) : [merged, ...list];
        return { ...prev, [key]: nextList } as ErpState;
      });

      void (async () => {
        try {
          await persistSave(key, item);
          if (opts?.notify) {
            await buildNotifications(opts.notify.userIds, {
              title: opts.notify.title,
              detail: ENTITY[key].describe(item as never, stateRef.current),
              type: ENTITY[key].label,
              link: opts.notify.link,
            });
          }
        } catch (err) {
          toast.error(sbError(err));
          void reloadFromServer();
        }
      })();

      return item;
    },
    [buildNotifications, reloadFromServer],
  );

  const patch = useCallback(
    <K extends CollectionKey>(
      key: K,
      id: string,
      changes: Partial<Collections[K]>,
      opts?: SaveOptions,
    ) => {
      const existing = (stateRef.current[key] as Collections[K][]).find((r) => r.id === id);
      if (!existing) return;
      save(key, { ...(existing as Draft<K>), ...changes, id } as Draft<K>, opts);
    },
    [save],
  );

  const removeMany = useCallback(
    <K extends CollectionKey>(key: K, ids: string[]) => {
      if (key === "activities") return;
      const idSet = new Set(ids);
      setState((prev) => {
        const list = prev[key] as Collections[K][];
        return { ...prev, [key]: list.filter((r) => !idSet.has(r.id)) } as ErpState;
      });
      void (async () => {
        try {
          await persistRemove(key, ids);
        } catch (err) {
          toast.error(sbError(err));
          void reloadFromServer();
        }
      })();
    },
    [reloadFromServer],
  );

  const remove = useCallback(
    <K extends CollectionKey>(key: K, id: string) => removeMany(key, [id]),
    [removeMany],
  );

  const updateSettings = useCallback(
    (p: Partial<Settings>) => {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, ...p } }));
      const orgId = stateRef.current.firmId;
      void (async () => {
        try {
          await persistSettings(orgId, p);
          if (p.firm?.name) {
            await persistOrgName(orgId, p.firm.name);
            setOrganization((o) => ({ ...o, name: p.firm!.name }));
          }
        } catch (err) {
          toast.error(sbError(err));
          void reloadFromServer();
        }
      })();
    },
    [reloadFromServer],
  );

  const rememberOption = useCallback(
    (key: "courts" | "enforcementOffices", value?: string) => {
      const v = value?.trim();
      if (!v) return;
      const list = stateRef.current.settings[key];
      if (list.some((x) => x.toLocaleLowerCase("tr") === v.toLocaleLowerCase("tr"))) return;
      const next = [...list, v].sort((a, b) => a.localeCompare(b, "tr"));
      updateSettings({ [key]: next } as Partial<Settings>);
    },
    [updateSettings],
  );

  /* ───────────── Auth ───────────── */

  const login = useCallback(
    async (username: string, password: string, remember = false): Promise<Result> => {
      if (!username.trim()) return { ok: false, error: "Kullanıcı adı girin" };
      const locked = loginLockSeconds();
      if (locked > 0)
        return {
          ok: false,
          error: `Çok fazla hatalı deneme. ${formatWait(locked)} sonra tekrar deneyin.`,
        };

      try {
        const { data: email, error: resolveErr } = await supabase.rpc("resolve_login", {
          p_identifier: username.trim(),
        });
        if (resolveErr) return { ok: false, error: resolveErr.message };
        if (!email) {
          loginFailed();
          return { ok: false, error: "Kullanıcı adı veya şifre hatalı" };
        }

        setRemember(remember);
        loginPasswordRef.current = password;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(email),
          password,
        });
        if (error || !data.user) {
          const wait = loginFailed();
          return {
            ok: false,
            error: wait
              ? `Çok fazla hatalı deneme. ${formatWait(wait)} sonra tekrar deneyin.`
              : "Kullanıcı adı veya şifre hatalı",
          };
        }

        loginSucceeded();
        const loaded = await reloadFromServer();
        const profile = loaded?.state.users.find((u) => u.id === data.user!.id);
        if (profile && !profile.active) {
          await supabase.auth.signOut();
          // Pasif hesap, kim olduğunu belli etmeden yanlış bilgi gibi görünür
          return { ok: false, error: "Kullanıcı adı veya şifre hatalı" };
        }
        if (!loaded?.organization.active) {
          await supabase.auth.signOut();
          return { ok: false, error: "Büro hesabı askıya alınmış" };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: sbError(err) };
      }
    },
    [reloadFromServer],
  );

  const logout = useCallback(() => {
    // Anında çıkış: ekran hemen temizlenir, sunucu oturumu arkadan kapatılır
    setSessionUserId(null);
    setMustChangePassword(false);
    setState(emptyState());
    setOrganization({ id: "", name: "", createdAt: "", active: true });
    toast.success("Çıkış yapıldı");
    void supabase.auth.signOut();
  }, []);

  const isUsernameAvailable = useCallback((username: string, exceptUserId?: string) => {
    const u = username.trim().toLocaleLowerCase("tr");
    return !stateRef.current.users.some(
      (x) => x.username.toLocaleLowerCase("tr") === u && x.id !== exceptUserId,
    );
  }, []);

  const registerOrganization = useCallback(
    async (input: RegisterInput): Promise<Result> => {
      const firmName = input.firmName.trim();
      const username = input.username.trim().toLocaleLowerCase("tr");
      if (!firmName) return { ok: false, error: "Büro adını girin" };
      if (!input.name.trim()) return { ok: false, error: "Adınızı girin" };
      if (!/^[a-z0-9çğıöşü._-]{3,}$/.test(username))
        return { ok: false, error: "Kullanıcı adı en az 3 karakter olmalı (harf, rakam, . _ -)" };
      if (!/^\S+@\S+\.\S+$/.test(input.email.trim()))
        return { ok: false, error: "Geçerli bir e-posta girin" };
      const problem = passwordProblem(input.password);
      if (problem) return { ok: false, error: problem };

      try {
        const { data: existing } = await supabase.rpc("resolve_login", {
          p_identifier: username,
        });
        if (existing) return { ok: false, error: "Bu kullanıcı adı alınmış" };

        const { data: sign, error: signErr } = await supabase.auth.signUp({
          email: input.email.trim(),
          password: input.password,
        });
        if (signErr) return { ok: false, error: signErr.message };
        if (!sign.user) return { ok: false, error: "Kayıt tamamlanamadı" };

        // E-posta onayı açıksa session olmayabilir; session yoksa şifre ile giriş dene
        if (!sign.session) {
          const { error: inErr } = await supabase.auth.signInWithPassword({
            email: input.email.trim(),
            password: input.password,
          });
          if (inErr)
            return {
              ok: false,
              error:
                "Hesap oluşturuldu ancak e-posta onayı gerekiyor. Gelen kutunuzu kontrol edin.",
            };
        }

        const { error: orgErr } = await supabase.rpc("create_organization", {
          p_org_name: firmName,
          p_full_name: input.name.trim(),
          p_username: username,
          p_phone: input.phone?.trim() || null,
        });
        if (orgErr) {
          return { ok: false, error: orgErr.message };
        }

        await reloadFromServer();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: sbError(err) };
      }
    },
    [reloadFromServer],
  );

  const requestPasswordReset = useCallback(async (emailOrUsername: string): Promise<Result> => {
    const raw = emailOrUsername.trim();
    if (!raw) return { ok: false, error: "E-posta veya kullanıcı adı girin" };
    try {
      let email = raw;
      if (!raw.includes("@")) {
        const { data } = await supabase.rpc("resolve_login", { p_identifier: raw });
        if (!data) return { ok: false, error: "Kullanıcı bulunamadı" };
        email = String(data);
      }
      const redirectTo = `${window.location.origin}/sifre-sifirla`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: sbError(err) };
    }
  }, []);

  const changePassword = useCallback(
    async (current: string, next: string): Promise<Result> => {
      const problem = passwordProblem(next);
      if (problem) return { ok: false, error: problem };
      const email = currentUser.email;
      if (!email) return { ok: false, error: "E-posta bulunamadı" };
      const { error: check } = await supabase.auth.signInWithPassword({ email, password: current });
      if (check) return { ok: false, error: "Mevcut şifre hatalı" };
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
    [currentUser.email],
  );

  const setFirstPassword = useCallback(async (next: string): Promise<Result> => {
    const problem = passwordProblem(next);
    if (problem) return { ok: false, error: problem };
    if (next === loginPasswordRef.current)
      return { ok: false, error: "Yeni şifre geçici şifreyle aynı olamaz" };
    const { error } = await supabase.auth.updateUser({
      password: next,
      data: { must_change_password: false },
    });
    if (error) return { ok: false, error: error.message };
    loginPasswordRef.current = "";
    setMustChangePassword(false);
    return { ok: true };
  }, []);

  const setUserPassword = useCallback(async (userId: string, next: string): Promise<Result> => {
    const problem = passwordProblem(next);
    if (problem) return { ok: false, error: problem };
    // Admin başkasının şifresini Edge Function ile sıfırlar; yoksa reset e-postası
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { ok: false, error: "Oturum yok" };
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { action: "set_password", userId, password: next },
      });
      if (error) {
        // Fonksiyon 4xx döndüyse asıl mesaj yanıt gövdesindedir
        let msg = "";
        const res = (error as { context?: Response }).context;
        if (res && typeof res.json === "function") {
          try {
            msg = String((await res.json())?.error ?? "");
          } catch {
            /* yoksay */
          }
        }
        return {
          ok: false,
          error: msg || "Şifre sıfırlanamadı. Sunucu fonksiyonu (invite-user) yayında olmayabilir.",
        };
      }
      if (data?.error) return { ok: false, error: String(data.error) };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: sbError(err) };
    }
  }, []);

  /* ───────────── Domain ───────────── */

  const recordInstallmentPayment = useCallback(
    (planId: string, installmentId: string, payment: Omit<InstallmentPayment, "id">) => {
      void (async () => {
        try {
          const { error } = await supabase.rpc("record_installment_payment", {
            p_plan: planId,
            p_installment: installmentId,
            p_amount: payment.amount,
            p_date: payment.date,
            p_method: payment.method,
            p_account: payment.accountId || null,
            p_note: payment.note || null,
          });
          if (error) throw error;
          await reloadFromServer();
          toast.success(`Tahsil edildi · ${formatMoney(payment.amount)}`);
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
    },
    [reloadFromServer],
  );

  const removeInstallmentPayment = useCallback(
    (planId: string, paymentId: string) => {
      void (async () => {
        try {
          const { error } = await supabase
            .from("installment_payments")
            .delete()
            .eq("id", paymentId);
          if (error) throw error;
          await reloadFromServer();
          toast.success("Ödeme geri alındı");
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
      void planId;
    },
    [reloadFromServer],
  );

  const createTransfer = useCallback(
    (t: { fromId: string; toId: string; amount: number; date: string; description: string }) => {
      const transferId = newId();
      const from = stateRef.current.accounts.find((a) => a.id === t.fromId);
      const to = stateRef.current.accounts.find((a) => a.id === t.toId);
      const rows = [
        {
          id: newId(),
          account_id: t.fromId,
          amount: -t.amount,
          category: "Virman",
          description: t.description || `${to?.name} hesabına virman`,
          date: t.date,
          transfer_id: transferId,
        },
        {
          id: newId(),
          account_id: t.toId,
          amount: t.amount,
          category: "Virman",
          description: t.description || `${from?.name} hesabından virman`,
          date: t.date,
          transfer_id: transferId,
        },
      ];
      void (async () => {
        try {
          const { error } = await supabase.from("account_transactions").insert(rows);
          if (error) throw error;
          await reloadFromServer();
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
    },
    [reloadFromServer],
  );

  const accrueMonthlyFees = useCallback(
    (_period: string) => {
      // Sunucu tarafı pg_cron / accrue_monthly_fees
      void (async () => {
        try {
          const { data, error } = await supabase.rpc("accrue_monthly_fees", {
            p_period: _period || null,
          });
          if (error) throw error;
          await reloadFromServer();
          if (data && Number(data) > 0)
            toast.success(`${data} müvekkil için aylık ücret oluşturuldu`);
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
      return 0;
    },
    [reloadFromServer],
  );

  const closeCase = useCallback(
    (caseId: string) => {
      void (async () => {
        try {
          const { error } = await supabase.rpc("close_case", { p_case: caseId });
          if (error) throw error;
          await reloadFromServer();
          toast.success("Dosya kapatıldı");
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
    },
    [reloadFromServer],
  );

  const archiveYears = useCallback(
    (throughYear: number) => {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc("archive_years", {
            p_through: throughYear,
          });
          if (error) throw error;
          await reloadFromServer();
          toast.success(`${data ?? 0} kayıt arşivlendi`);
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
      return 0;
    },
    [reloadFromServer],
  );

  const createDebtorPlan = useCallback(
    (p: {
      enforcementId: string;
      debtorId: string;
      rows: { dueDate: string; amount: number }[];
      note?: string;
    }) => {
      const planId = newId();
      const rows = p.rows.map((r, i) => ({
        id: newId(),
        enforcement_id: p.enforcementId,
        debtor_id: p.debtorId,
        amount: round2(r.amount),
        due_date: r.dueDate,
        status: "Bekliyor",
        plan_id: planId,
        installment_no: i + 1,
        note: p.note || null,
      }));
      void (async () => {
        try {
          const { error } = await supabase.from("payment_promises").insert(rows);
          if (error) throw error;
          await reloadFromServer();
          toast.success(
            `${debtorName(stateRef.current, p.debtorId)} · ${rows.length} taksit · ${formatMoney(sum(rows.map((c) => c.amount)))}`,
          );
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
    },
    [reloadFromServer],
  );

  const notifyUsers = useCallback(
    (userIds: string[], n: { title: string; detail: string; type: string; link?: string }) => {
      void buildNotifications(userIds, n);
    },
    [buildNotifications],
  );

  const markNotificationsRead = useCallback(
    (ids?: string[]) => {
      const set = ids ? new Set(ids) : null;
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.userId === currentUserId && (!set || set.has(n.id)) && !n.read
            ? { ...n, read: true }
            : n,
        ),
      }));
      void (async () => {
        let q = supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", currentUserId)
          .eq("read", false);
        if (ids?.length) q = q.in("id", ids);
        const { error } = await q;
        if (error) toast.error(error.message);
      })();
    },
    [currentUserId],
  );

  const importRecords = useCallback(
    (batch: ImportBatch, _label: string) => {
      const keys = Object.keys(batch) as CollectionKey[];
      let count = 0;
      void (async () => {
        try {
          for (const key of keys) {
            for (const d of batch[key] ?? []) {
              const id = d.id ?? newId();
              const now = new Date().toISOString();
              const item = {
                ...d,
                id,
                firmId: stateRef.current.firmId,
                createdAt: now,
                updatedAt: now,
              } as Collections[typeof key];
              await persistSave(key, item);
              count++;
            }
          }
          await reloadFromServer();
          toast.success(`${count} kayıt aktarıldı`);
        } catch (err) {
          toast.error(sbError(err));
        }
      })();
      return keys.reduce((n, k) => n + (batch[k]?.length ?? 0), 0);
    },
    [reloadFromServer],
  );

  const replaceState = useCallback((_next: ErpState) => {
    toast.info(
      "Yedek geri yükleme sunucu aktarımı gerektirir. Destek ile iletişime geçin veya kayıtları Excel ile aktarın.",
    );
  }, []);

  const resetDemo = useCallback(() => {
    toast.info("Demo veri kaldırıldı; uygulama Supabase üzerinden çalışıyor.");
  }, []);

  const get = useCallback(
    <K extends CollectionKey>(key: K, id?: string) =>
      id ? (state[key] as Collections[K][]).find((r) => r.id === id) : undefined,
    [state],
  );

  const staff = useMemo(() => state.users.filter((u) => u.active), [state.users]);
  const lawyers = useMemo(
    () => staff.filter((u) => u.role === "Avukat" || u.role === "Admin"),
    [staff],
  );

  const value: ErpContextValue = {
    state,
    hydrated,
    loading,
    isAuthenticated,
    organization,
    currentUser,
    permissions,
    login,
    logout,
    registerOrganization,
    isUsernameAvailable,
    changePassword,
    mustChangePassword,
    setFirstPassword,
    setUserPassword,
    requestPasswordReset,
    save,
    patch,
    remove,
    removeMany,
    updateSettings,
    rememberOption,
    recordInstallmentPayment,
    removeInstallmentPayment,
    createTransfer,
    accrueMonthlyFees,
    closeCase,
    archiveYears,
    createDebtorPlan,
    markNotificationsRead,
    notifyUsers,
    importRecords,
    replaceState,
    resetDemo,
    reloadFromServer,
    get,
    staff,
    lawyers,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used within ErpProvider");
  return ctx;
}

export { today };

// ActivityLog tipini export için tut (lint)
export type { ActivityLog };
