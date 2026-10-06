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
import { createSeedState, FIRM_ID } from "@/lib/erp-data";
import {
  permissionsFor,
  type ActivityLog,
  type AppNotification,
  type CollectionKey,
  type Collections,
  type ErpState,
  type FieldChange,
  type InstallmentPayment,
  type Permissions,
  type Settings,
  type User,
} from "@/lib/erp-types";
import { applyPaymentToPlan, caseLabel } from "@/lib/finance";
import { formatMoney, today } from "@/lib/format";
import { createPasswordRecord, passwordProblem, verifyPassword } from "@/lib/auth";
import { loadPersistedState, normalizeState, STORAGE_KEY } from "@/lib/migrations";

const SESSION_KEY = "lex-erp-session-v1";

export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ───────────── Varlık tanımları (aktivite metinleri için) ───────────── */

type EntityMeta = {
  label: string;
  prefix: string;
  audit: boolean;
  describe: (item: never, s: ErpState) => string;
};

const money = (n?: number) => (n == null ? "" : formatMoney(n));
const clientName = (s: ErpState, id?: string) => s.clients.find((c) => c.id === id)?.name ?? "";

const ENTITY: { [K in CollectionKey]: EntityMeta } = {
  users: {
    label: "Kullanıcı",
    prefix: "usr",
    audit: true,
    describe: (u: Collections["users"]) => `${u.name} (${u.role})`,
  },
  clients: {
    label: "Müvekkil",
    prefix: "cli",
    audit: true,
    describe: (c: Collections["clients"]) => c.name,
  },
  cases: {
    label: "Dosya",
    prefix: "case",
    audit: true,
    describe: (c: Collections["cases"]) => caseLabel(c),
  },
  expenses: {
    label: "Masraf",
    prefix: "exp",
    audit: true,
    describe: (e: Collections["expenses"]) => `${e.title} · ${money(e.amount)}`,
  },
  advances: {
    label: "Avans",
    prefix: "adv",
    audit: true,
    describe: (a: Collections["advances"], s) =>
      `${a.kind} · ${clientName(s, a.clientId)} · ${money(a.amount)}`,
  },
  plans: {
    label: "Tahsilat planı",
    prefix: "plan",
    audit: true,
    describe: (p: Collections["plans"], s) =>
      `${p.title} · ${clientName(s, p.clientId)} · ${money(p.total)}`,
  },
  accounts: {
    label: "Hesap",
    prefix: "acc",
    audit: true,
    describe: (a: Collections["accounts"]) => a.name,
  },
  transactions: {
    label: "Hesap hareketi",
    prefix: "tx",
    audit: true,
    describe: (t: Collections["transactions"]) => `${t.description} · ${money(t.amount)}`,
  },
  reminders: {
    label: "Ajanda",
    prefix: "rem",
    audit: true,
    describe: (r: Collections["reminders"]) => `${r.type} · ${r.title}`,
  },
  debtors: {
    label: "Borçlu",
    prefix: "dbt",
    audit: true,
    describe: (d: Collections["debtors"]) => d.name,
  },
  enforcements: {
    label: "İcra dosyası",
    prefix: "enf",
    audit: true,
    describe: (e: Collections["enforcements"]) => `${e.no} · ${e.office}`,
  },
  promises: {
    label: "Ödeme sözü",
    prefix: "prm",
    audit: true,
    describe: (p: Collections["promises"]) => `${money(p.amount)} · ${p.dueDate}`,
  },
  collections: {
    label: "İcra tahsilatı",
    prefix: "col",
    audit: true,
    describe: (c: Collections["collections"]) => money(c.amount),
  },
  contacts: {
    label: "Görüşme notu",
    prefix: "cnt",
    audit: false,
    describe: (c: Collections["contacts"]) => c.channel,
  },
  documents: {
    label: "Belge",
    prefix: "doc",
    audit: true,
    describe: (d: Collections["documents"]) => d.name,
  },
  docRequests: {
    label: "Belge talebi",
    prefix: "req",
    audit: true,
    describe: (r: Collections["docRequests"]) => r.title,
  },
  messages: { label: "Mesaj", prefix: "msg", audit: false, describe: () => "" },
  notifications: { label: "Bildirim", prefix: "ntf", audit: false, describe: () => "" },
  activities: { label: "Aktivite", prefix: "act", audit: false, describe: () => "" },
};

export function entityLabel(key: CollectionKey) {
  return ENTITY[key].label;
}

const META_FIELDS = new Set([
  "id",
  "firmId",
  "createdAt",
  "updatedAt",
  "passwordHash",
  "passwordSalt",
]);

function display(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? `${v.length} kayıt` : "—";
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v === "object") return "…";
  return String(v);
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (META_FIELDS.has(k)) continue;
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(after[k] ?? null);
    if (a !== b) out.push({ field: k, before: display(before[k]), after: display(after[k]) });
  }
  return out;
}

/* ───────────── Context tipi ───────────── */

export type Draft<K extends CollectionKey> = Omit<
  Collections[K],
  "id" | "firmId" | "createdAt" | "updatedAt"
> & { id?: string };

type SaveOptions = {
  /** Bildirim gidecek kullanıcılar (kendisi hariç tutulur) */
  notify?: { userIds: string[]; title: string; link?: string };
  silent?: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

type ErpContextValue = {
  state: ErpState;
  hydrated: boolean;
  isAuthenticated: boolean;
  currentUser: User;
  permissions: Permissions;
  login: (username: string, password: string) => Promise<Result>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<Result>;
  setUserPassword: (userId: string, next: string) => Promise<Result>;

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
  sendMessage: (clientId: string, body: string) => void;
  markMessagesRead: (clientId: string) => void;
  markNotificationsRead: (ids?: string[]) => void;
  notifyUsers: (
    userIds: string[],
    n: { title: string; detail: string; type: string; link?: string },
  ) => void;

  replaceState: (next: ErpState) => void;
  resetDemo: () => void;

  get: <K extends CollectionKey>(key: K, id?: string) => Collections[K] | undefined;
  staff: User[];
  lawyers: User[];
};

const ErpContext = createContext<ErpContextValue | null>(null);

function loadSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function ErpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErpState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const skipPersist = useRef(false);

  useEffect(() => {
    setState(loadPersistedState());
    setSessionUserId(loadSessionUserId());
    setHydrated(true);
  }, []);

  // Kalıcılık
  useEffect(() => {
    if (!hydrated) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error(err);
      toast.error("Veri kaydedilemedi: tarayıcı depolama alanı dolu olabilir.");
    }
  }, [state, hydrated]);

  // Diğer sekmelerle senkron (ör. müvekkil portalı ayrı sekmede)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          skipPersist.current = true;
          setState(normalizeState(JSON.parse(e.newValue)));
        } catch {
          /* yoksay */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const sessionUser = useMemo(
    () => state.users.find((u) => u.id === sessionUserId && u.active),
    [state.users, sessionUserId],
  );
  const isAuthenticated = !!sessionUser;
  const currentUser = sessionUser ?? state.users[0];
  const permissions = useMemo(() => permissionsFor(currentUser.role), [currentUser.role]);
  const currentUserId = currentUser.id;

  /* ───────────── Yardımcılar ───────────── */

  const buildActivity = useCallback(
    (
      s: ErpState,
      a: Omit<ActivityLog, "id" | "firmId" | "createdAt" | "updatedAt" | "actorId">,
    ): ErpState => {
      const now = new Date().toISOString();
      const log: ActivityLog = {
        ...a,
        id: uid("act"),
        firmId: FIRM_ID,
        createdAt: now,
        updatedAt: now,
        actorId: currentUserId,
      };
      return { ...s, activities: [log, ...s.activities].slice(0, 1000) };
    },
    [currentUserId],
  );

  const buildNotifications = useCallback(
    (
      s: ErpState,
      userIds: string[],
      n: { title: string; detail: string; type: string; link?: string },
    ): ErpState => {
      const now = new Date().toISOString();
      const targets = [...new Set(userIds)].filter((id) => id && id !== currentUserId);
      if (!targets.length) return s;
      const created: AppNotification[] = targets.map((userId) => ({
        id: uid("ntf"),
        firmId: FIRM_ID,
        createdAt: now,
        updatedAt: now,
        userId,
        read: false,
        ...n,
      }));
      return { ...s, notifications: [...created, ...s.notifications].slice(0, 500) };
    },
    [currentUserId],
  );

  /* ───────────── Generic CRUD ───────────── */

  const save = useCallback(
    <K extends CollectionKey>(key: K, data: Draft<K>, opts?: SaveOptions): Collections[K] => {
      const now = new Date().toISOString();
      const meta = ENTITY[key];
      const existingNow = data.id
        ? (stateRef.current[key] as Collections[K][]).find((r) => r.id === data.id)
        : undefined;
      const id = data.id ?? uid(meta.prefix);
      const item = {
        ...(existingNow ?? {}),
        ...data,
        id,
        firmId: FIRM_ID,
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
        let next = { ...prev, [key]: nextList } as ErpState;
        if (meta.audit && !opts?.silent) {
          const changes = before
            ? diff(before as Record<string, unknown>, merged as Record<string, unknown>)
            : undefined;
          if (!before || changes?.length) {
            next = buildActivity(next, {
              action: before ? "Güncelleme" : "Ekleme",
              entity: meta.label,
              entityId: id,
              detail: meta.describe(merged as never, next),
              changes,
            });
          }
        }
        if (opts?.notify) {
          next = buildNotifications(next, opts.notify.userIds, {
            title: opts.notify.title,
            detail: meta.describe(merged as never, next),
            type: meta.label,
            link: opts.notify.link,
          });
        }
        return next;
      });
      return item;
    },
    [buildActivity, buildNotifications],
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
      const idSet = new Set(ids);
      setState((prev) => {
        const list = prev[key] as Collections[K][];
        const removed = list.filter((r) => idSet.has(r.id));
        if (!removed.length) return prev;
        let next = { ...prev, [key]: list.filter((r) => !idSet.has(r.id)) } as ErpState;
        const meta = ENTITY[key];
        if (meta.audit) {
          for (const r of removed) {
            next = buildActivity(next, {
              action: "Silme",
              entity: meta.label,
              entityId: r.id,
              detail: meta.describe(r as never, prev),
            });
          }
        }
        return next;
      });
    },
    [buildActivity],
  );

  const remove = useCallback(
    <K extends CollectionKey>(key: K, id: string) => removeMany(key, [id]),
    [removeMany],
  );

  const updateSettings = useCallback(
    (p: Partial<Settings>) => {
      setState((prev) =>
        buildActivity(
          { ...prev, settings: { ...prev.settings, ...p } },
          { action: "Güncelleme", entity: "Ayarlar", detail: Object.keys(p).join(", ") },
        ),
      );
    },
    [buildActivity],
  );

  /* ───────────── Oturum ───────────── */

  const login = useCallback(async (username: string, password: string): Promise<Result> => {
    const normalized = username.trim().toLocaleLowerCase("tr");
    if (!normalized) return { ok: false, error: "Kullanıcı adı girin" };
    const user = stateRef.current.users.find(
      (u) =>
        u.username.toLocaleLowerCase("tr") === normalized ||
        u.email.toLocaleLowerCase("tr") === normalized,
    );
    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      return { ok: false, error: "Kullanıcı adı veya şifre hatalı" };
    }
    if (!user.active) return { ok: false, error: "Bu hesap devre dışı bırakılmış" };
    if (user.role === "Müvekkil") {
      const client = stateRef.current.clients.find((c) => c.id === user.clientId);
      if (!client?.portalEnabled)
        return { ok: false, error: "Portal erişiminiz kapalı. Büronuzla iletişime geçin." };
    }
    localStorage.setItem(SESSION_KEY, user.id);
    setSessionUserId(user.id);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSessionUserId(null);
  }, []);

  const setUserPassword = useCallback(
    async (userId: string, next: string): Promise<Result> => {
      const problem = passwordProblem(next);
      if (problem) return { ok: false, error: problem };
      const record = await createPasswordRecord(next);
      setState((prev) =>
        buildActivity(
          {
            ...prev,
            users: prev.users.map((u) =>
              u.id === userId ? { ...u, ...record, updatedAt: new Date().toISOString() } : u,
            ),
          },
          { action: "İşlem", entity: "Kullanıcı", entityId: userId, detail: "Şifre değiştirildi" },
        ),
      );
      return { ok: true };
    },
    [buildActivity],
  );

  const changePassword = useCallback(
    async (current: string, next: string): Promise<Result> => {
      const u = stateRef.current.users.find((x) => x.id === currentUserId);
      if (!u || !(await verifyPassword(current, u.passwordSalt, u.passwordHash))) {
        return { ok: false, error: "Mevcut şifre hatalı" };
      }
      return setUserPassword(currentUserId, next);
    },
    [currentUserId, setUserPassword],
  );

  /* ───────────── Domain işlemleri ───────────── */

  const recordInstallmentPayment = useCallback(
    (planId: string, installmentId: string, payment: Omit<InstallmentPayment, "id">) => {
      setState((prev) => {
        const plan = prev.plans.find((p) => p.id === planId);
        if (!plan) return prev;
        const updated = {
          ...applyPaymentToPlan(plan, installmentId, payment, () => uid("ip")),
          updatedAt: new Date().toISOString(),
        };
        let next: ErpState = {
          ...prev,
          plans: prev.plans.map((p) => (p.id === planId ? updated : p)),
        };
        next = buildActivity(next, {
          action: "İşlem",
          entity: "Tahsilat",
          entityId: planId,
          detail: `Tahsil edildi · ${clientName(prev, plan.clientId)} · ${formatMoney(payment.amount)}`,
        });
        return next;
      });
    },
    [buildActivity],
  );

  const removeInstallmentPayment = useCallback(
    (planId: string, paymentId: string) => {
      setState((prev) => {
        const plan = prev.plans.find((p) => p.id === planId);
        if (!plan) return prev;
        const removed = plan.installments
          .flatMap((i) => i.payments)
          .find((p) => p.id === paymentId);
        const updated = {
          ...plan,
          updatedAt: new Date().toISOString(),
          installments: plan.installments.map((i) => ({
            ...i,
            payments: i.payments.filter((p) => p.id !== paymentId),
          })),
        };
        return buildActivity(
          { ...prev, plans: prev.plans.map((p) => (p.id === planId ? updated : p)) },
          {
            action: "Silme",
            entity: "Tahsilat",
            entityId: planId,
            detail: `Ödeme geri alındı · ${formatMoney(removed?.amount ?? 0)}`,
          },
        );
      });
    },
    [buildActivity],
  );

  const createTransfer = useCallback(
    (t: { fromId: string; toId: string; amount: number; date: string; description: string }) => {
      const transferId = uid("trf");
      const now = new Date().toISOString();
      const base = {
        firmId: FIRM_ID,
        createdAt: now,
        updatedAt: now,
        category: "Virman" as const,
        transferId,
        date: t.date,
      };
      setState((prev) => {
        const from = prev.accounts.find((a) => a.id === t.fromId);
        const to = prev.accounts.find((a) => a.id === t.toId);
        const next: ErpState = {
          ...prev,
          transactions: [
            {
              ...base,
              id: uid("tx"),
              accountId: t.fromId,
              amount: -t.amount,
              description: t.description || `${to?.name} hesabına virman`,
            },
            {
              ...base,
              id: uid("tx"),
              accountId: t.toId,
              amount: t.amount,
              description: t.description || `${from?.name} hesabından virman`,
            },
            ...prev.transactions,
          ],
        };
        return buildActivity(next, {
          action: "İşlem",
          entity: "Virman",
          detail: `${from?.name} → ${to?.name} · ${formatMoney(t.amount)}`,
        });
      });
    },
    [buildActivity],
  );

  const accrueMonthlyFees = useCallback(
    (period: string) => {
      const s = stateRef.current;
      const due = `${period}-05`;
      const targets = s.clients.filter(
        (c) =>
          c.status === "Aktif" &&
          c.monthlyFee &&
          (!c.monthlyFeeStartDate || c.monthlyFeeStartDate.slice(0, 7) <= period) &&
          !s.plans.some((p) => p.clientId === c.id && p.period === period && !p.cancelled),
      );
      if (!targets.length) return 0;
      const now = new Date().toISOString();
      setState((prev) => {
        const created = targets.map((c) => ({
          id: uid("plan"),
          firmId: FIRM_ID,
          createdAt: now,
          updatedAt: now,
          title: "Aylık danışmanlık ücreti",
          kind: "Aylık ücret" as const,
          clientId: c.id,
          date: `${period}-01`,
          total: c.monthlyFee!,
          period,
          cancelled: false,
          installments: [{ id: uid("inst"), dueDate: due, amount: c.monthlyFee!, payments: [] }],
        }));
        return buildActivity(
          { ...prev, plans: [...created, ...prev.plans] },
          {
            action: "İşlem",
            entity: "Tahsilat",
            detail: `${period} aylık ücret tahakkuku · ${created.length} müvekkil`,
          },
        );
      });
      return targets.length;
    },
    [buildActivity],
  );

  const notifyUsers = useCallback(
    (userIds: string[], n: { title: string; detail: string; type: string; link?: string }) => {
      setState((prev) => buildNotifications(prev, userIds, n));
    },
    [buildNotifications],
  );

  const sendMessage = useCallback(
    (clientId: string, body: string) => {
      const text = body.trim();
      if (!text) return;
      const now = new Date().toISOString();
      const fromClient = currentUser.role === "Müvekkil";
      setState((prev) => {
        let next: ErpState = {
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: uid("msg"),
              firmId: FIRM_ID,
              createdAt: now,
              updatedAt: now,
              clientId,
              authorId: currentUserId,
              body: text,
              readByFirm: !fromClient,
              readByClient: fromClient,
            },
          ],
        };
        if (fromClient) {
          const responsible = prev.cases
            .filter((c) => c.clientId === clientId)
            .flatMap((c) => c.responsibleIds);
          const admins = prev.users
            .filter((u) => u.role === "Admin" || u.role === "Sekreter")
            .map((u) => u.id);
          next = buildNotifications(next, [...responsible, ...admins], {
            title: "Müvekkilden yeni mesaj",
            detail: `${clientName(prev, clientId)}: ${text.slice(0, 80)}`,
            type: "Mesaj",
            link: `/mesajlar?musteri=${clientId}`,
          });
        }
        return next;
      });
    },
    [buildNotifications, currentUser.role, currentUserId],
  );

  const markMessagesRead = useCallback(
    (clientId: string) => {
      const asClient = currentUser.role === "Müvekkil";
      setState((prev) => {
        const needs = prev.messages.some(
          (m) => m.clientId === clientId && (asClient ? !m.readByClient : !m.readByFirm),
        );
        if (!needs) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.clientId !== clientId
              ? m
              : asClient
                ? { ...m, readByClient: true }
                : { ...m, readByFirm: true },
          ),
        };
      });
    },
    [currentUser.role],
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
    },
    [currentUserId],
  );

  const replaceState = useCallback((next: ErpState) => setState(normalizeState(next)), []);
  const resetDemo = useCallback(() => setState(createSeedState()), []);

  const get = useCallback(
    <K extends CollectionKey>(key: K, id?: string) =>
      id ? (state[key] as Collections[K][]).find((r) => r.id === id) : undefined,
    [state],
  );

  const staff = useMemo(
    () => state.users.filter((u) => u.role !== "Müvekkil" && u.active),
    [state.users],
  );
  const lawyers = useMemo(
    () => staff.filter((u) => u.role === "Avukat" || u.role === "Admin"),
    [staff],
  );

  const value: ErpContextValue = {
    state,
    hydrated,
    isAuthenticated,
    currentUser,
    permissions,
    login,
    logout,
    changePassword,
    setUserPassword,
    save,
    patch,
    remove,
    removeMany,
    updateSettings,
    recordInstallmentPayment,
    removeInstallmentPayment,
    createTransfer,
    accrueMonthlyFees,
    sendMessage,
    markMessagesRead,
    markNotificationsRead,
    notifyUsers,
    replaceState,
    resetDemo,
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
