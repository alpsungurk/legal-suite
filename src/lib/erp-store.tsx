import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedState, DEMO_PASSWORD } from "@/lib/erp-data";
import {
  permissionsFor,
  type ActivityLog,
  type CaseFile,
  type Client,
  type ErpState,
  type Expense,
  type Payment,
  type Reminder,
  type User,
} from "@/lib/erp-types";

const STORAGE_KEY = "lex-erp-state-v2";
const AUTH_KEY = "lex-erp-auth-v1";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadState(): ErpState {
  if (typeof window === "undefined") return createSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as ErpState;
    const seed = createSeedState();
    const seedById = new Map(seed.users.map((u) => [u.id, u]));
    const mergedUsers = [
      ...seed.users.map((seedUser) => {
        const existing = parsed.users?.find((u) => u.id === seedUser.id);
        return existing
          ? {
              ...seedUser,
              ...existing,
              username: existing.username || seedUser.username,
              role: existing.role || seedUser.role,
            }
          : seedUser;
      }),
      ...(parsed.users ?? []).filter((u) => !seedById.has(u.id) && u.username),
    ];
    return {
      ...seed,
      ...parsed,
      users: mergedUsers.length ? mergedUsers : seed.users,
      caseTypes: parsed.caseTypes?.length ? parsed.caseTypes : seed.caseTypes,
      expenseTypes: parsed.expenseTypes?.length ? parsed.expenseTypes : seed.expenseTypes,
      reminderTypes: parsed.reminderTypes?.length ? parsed.reminderTypes : seed.reminderTypes,
    };
  } catch {
    return createSeedState();
  }
}

function loadAuthUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_KEY);
}

type EntityKey = "users" | "clients" | "cases" | "expenses" | "payments" | "reminders";

type ErpContextValue = {
  state: ErpState;
  currentUser: User;
  permissions: ReturnType<typeof permissionsFor>;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  setCurrentUserId: (id: string) => void;
  upsertUser: (data: Omit<User, "id"> & { id?: string }) => void;
  deleteUser: (id: string) => void;
  upsertClient: (data: Omit<Client, "id"> & { id?: string }) => void;
  deleteClient: (id: string) => void;
  upsertCase: (data: Omit<CaseFile, "id"> & { id?: string }) => void;
  deleteCase: (id: string) => void;
  upsertExpense: (data: Omit<Expense, "id"> & { id?: string }) => void;
  deleteExpense: (id: string) => void;
  upsertPayment: (data: Omit<Payment, "id"> & { id?: string }) => void;
  deletePayment: (id: string) => void;
  upsertReminder: (data: Omit<Reminder, "id"> & { id?: string }) => void;
  deleteReminder: (id: string) => void;
  addCategory: (kind: "caseTypes" | "expenseTypes" | "reminderTypes", name: string) => void;
  removeCategory: (kind: "caseTypes" | "expenseTypes" | "reminderTypes", name: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  findClient: (id: string) => Client | undefined;
  findCase: (id: string) => CaseFile | undefined;
  findUser: (id: string) => User | undefined;
  clientOptions: string[];
  caseOptions: string[];
  userOptions: string[];
  caseIdByLabel: (label: string) => string | undefined;
  clientIdByName: (name: string) => string | undefined;
  userIdByName: (name: string) => string | undefined;
  caseLabel: (item: CaseFile) => string;
  formatMoney: (n: number) => string;
  searchAll: (query: string) => Array<{
    id: string;
    title: string;
    subtitle: string;
    type: string;
    href: string;
  }>;
};

const ErpContext = createContext<ErpContextValue | null>(null);

export function ErpProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ErpState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const next = loadState();
    const authId = loadAuthUserId();
    if (authId && next.users.some((u) => u.id === authId)) {
      next.currentUserId = authId;
      setIsAuthenticated(true);
    }
    setState(next);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId],
  );
  const permissions = useMemo(() => permissionsFor(currentUser.role), [currentUser.role]);

  const login = useCallback(
    (username: string, password: string) => {
      const normalized = username.trim().toLocaleLowerCase("tr");
      if (!normalized) return { ok: false as const, error: "Kullanıcı adı girin" };
      if (password !== DEMO_PASSWORD) {
        return { ok: false as const, error: "Kullanıcı adı veya şifre hatalı" };
      }
      const user = state.users.find(
        (u) => (u.username ?? "").toLocaleLowerCase("tr") === normalized,
      );
      if (!user) return { ok: false as const, error: "Kullanıcı adı veya şifre hatalı" };
      setState((prev) => ({ ...prev, currentUserId: user.id }));
      localStorage.setItem(AUTH_KEY, user.id);
      setIsAuthenticated(true);
      return { ok: true as const };
    },
    [state.users],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  }, []);

  const pushActivity = useCallback(
    (
      prev: ErpState,
      action: string,
      entity: string,
      detail: string,
      amount?: string,
      notifyUserId?: string,
      notifyType?: string,
    ): ErpState => {
      const activity: ActivityLog = {
        id: uid("act"),
        actorId: prev.currentUserId,
        action,
        entity,
        detail,
        timestamp: new Date().toISOString(),
        amount,
      };
      const notifications = [...prev.notifications];
      if (notifyUserId) {
        notifications.unshift({
          id: uid("ntf"),
          userId: notifyUserId,
          title: action,
          detail,
          type: notifyType ?? entity,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
      return {
        ...prev,
        activities: [activity, ...prev.activities].slice(0, 200),
        notifications: notifications.slice(0, 100),
      };
    },
    [],
  );

  const setCurrentUserId = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentUserId: id }));
    localStorage.setItem(AUTH_KEY, id);
    setIsAuthenticated(true);
  }, []);

  const mutateList = useCallback(
    <T extends { id: string }>(
      key: EntityKey,
      item: T,
      isNew: boolean,
      label: string,
      entity: string,
      notifyUserId?: string,
    ) => {
      setState((prev) => {
        const list = prev[key] as T[];
        const nextList = isNew
          ? [item, ...list]
          : list.map((row) => (row.id === item.id ? item : row));
        let next: ErpState = { ...prev, [key]: nextList };
        next = pushActivity(
          next,
          isNew ? `${entity} eklendi` : `${entity} güncellendi`,
          entity,
          label,
          undefined,
          notifyUserId,
          entity,
        );
        return next;
      });
    },
    [pushActivity],
  );

  const upsertUser = useCallback(
    (data: Omit<User, "id"> & { id?: string }) => {
      const isNew = !data.id;
      const item: User = {
        id: data.id ?? uid("usr"),
        name: data.name,
        email: data.email,
        role: data.role,
        username: (data.username || data.name).trim().toLocaleLowerCase("tr").replaceAll(" ", ""),
      };
      mutateList("users", item, isNew, item.name, "Kullanıcı");
    },
    [mutateList],
  );

  const deleteUser = useCallback(
    (id: string) => {
      setState((prev) => {
        const user = prev.users.find((u) => u.id === id);
        if (!user || id === prev.currentUserId) return prev;
        let next: ErpState = {
          ...prev,
          users: prev.users.filter((u) => u.id !== id),
        };
        next = pushActivity(next, "Kullanıcı silindi", "Kullanıcı", user.name);
        return next;
      });
    },
    [pushActivity],
  );

  const upsertClient = useCallback(
    (data: Omit<Client, "id"> & { id?: string }) => {
      const isNew = !data.id;
      const item: Client = { ...data, id: data.id ?? uid("cli") };
      mutateList("clients", item, isNew, item.name, "Müvekkil");
    },
    [mutateList],
  );

  const deleteClient = useCallback(
    (id: string) => {
      setState((prev) => {
        const client = prev.clients.find((c) => c.id === id);
        if (!client) return prev;
        let next: ErpState = {
          ...prev,
          clients: prev.clients.filter((c) => c.id !== id),
        };
        next = pushActivity(next, "Müvekkil silindi", "Müvekkil", client.name);
        return next;
      });
    },
    [pushActivity],
  );

  const upsertCase = useCallback(
    (data: Omit<CaseFile, "id"> & { id?: string }) => {
      const isNew = !data.id;
      const item: CaseFile = { ...data, id: data.id ?? uid("case") };
      mutateList("cases", item, isNew, `${item.no} • ${item.title}`, "Dosya", item.responsibleId);
    },
    [mutateList],
  );

  const deleteCase = useCallback(
    (id: string) => {
      setState((prev) => {
        const item = prev.cases.find((c) => c.id === id);
        if (!item) return prev;
        let next: ErpState = {
          ...prev,
          cases: prev.cases.filter((c) => c.id !== id),
        };
        next = pushActivity(next, "Dosya silindi", "Dosya", `${item.no} • ${item.title}`);
        return next;
      });
    },
    [pushActivity],
  );

  const upsertExpense = useCallback(
    (data: Omit<Expense, "id"> & { id?: string }) => {
      setState((prev) => {
        const isNew = !data.id;
        const item: Expense = { ...data, id: data.id ?? uid("exp") };
        const list = isNew
          ? [item, ...prev.expenses]
          : prev.expenses.map((row) => (row.id === item.id ? item : row));
        const caseFile = prev.cases.find((c) => c.id === item.caseId);
        let next: ErpState = { ...prev, expenses: list };
        next = pushActivity(
          next,
          isNew ? "Masraf eklendi" : "Masraf güncellendi",
          "Masraf",
          item.title,
          undefined,
          caseFile?.responsibleId,
          "Masraf",
        );
        return next;
      });
    },
    [pushActivity],
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setState((prev) => {
        const item = prev.expenses.find((e) => e.id === id);
        if (!item) return prev;
        let next: ErpState = {
          ...prev,
          expenses: prev.expenses.filter((e) => e.id !== id),
        };
        next = pushActivity(next, "Masraf silindi", "Masraf", item.title);
        return next;
      });
    },
    [pushActivity],
  );

  const upsertPayment = useCallback(
    (data: Omit<Payment, "id"> & { id?: string }) => {
      setState((prev) => {
        const isNew = !data.id;
        const item: Payment = { ...data, id: data.id ?? uid("pay") };
        const list = isNew
          ? [item, ...prev.payments]
          : prev.payments.map((row) => (row.id === item.id ? item : row));
        const caseFile = prev.cases.find((c) => c.id === item.caseId);
        let next: ErpState = { ...prev, payments: list };
        next = pushActivity(
          next,
          isNew ? "Tahsilat eklendi" : "Tahsilat güncellendi",
          "Tahsilat",
          item.description || caseFile?.no || item.id,
          undefined,
          caseFile?.responsibleId,
          "Tahsilat",
        );
        return next;
      });
    },
    [pushActivity],
  );

  const deletePayment = useCallback(
    (id: string) => {
      setState((prev) => {
        const item = prev.payments.find((p) => p.id === id);
        if (!item) return prev;
        let next: ErpState = {
          ...prev,
          payments: prev.payments.filter((p) => p.id !== id),
        };
        next = pushActivity(next, "Tahsilat silindi", "Tahsilat", item.description);
        return next;
      });
    },
    [pushActivity],
  );

  const upsertReminder = useCallback(
    (data: Omit<Reminder, "id"> & { id?: string }) => {
      const isNew = !data.id;
      const item: Reminder = { ...data, id: data.id ?? uid("rem") };
      mutateList("reminders", item, isNew, item.title, "Hatırlatma", item.assigneeId);
    },
    [mutateList],
  );

  const deleteReminder = useCallback(
    (id: string) => {
      setState((prev) => {
        const item = prev.reminders.find((r) => r.id === id);
        if (!item) return prev;
        let next: ErpState = {
          ...prev,
          reminders: prev.reminders.filter((r) => r.id !== id),
        };
        next = pushActivity(next, "Hatırlatma silindi", "Hatırlatma", item.title);
        return next;
      });
    },
    [pushActivity],
  );

  const addCategory = useCallback(
    (kind: "caseTypes" | "expenseTypes" | "reminderTypes", name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setState((prev) => {
        if (prev[kind].includes(trimmed)) return prev;
        let next: ErpState = { ...prev, [kind]: [...prev[kind], trimmed] };
        next = pushActivity(next, "Kategori eklendi", "Ayarlar", `${kind}: ${trimmed}`);
        return next;
      });
    },
    [pushActivity],
  );

  const removeCategory = useCallback(
    (kind: "caseTypes" | "expenseTypes" | "reminderTypes", name: string) => {
      setState((prev) => {
        let next: ErpState = {
          ...prev,
          [kind]: prev[kind].filter((item) => item !== name),
        };
        next = pushActivity(next, "Kategori silindi", "Ayarlar", `${kind}: ${name}`);
        return next;
      });
    },
    [pushActivity],
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.userId === prev.currentUserId ? { ...n, read: true } : n,
      ),
    }));
  }, []);

  const findClientFn = useCallback(
    (id: string) => state.clients.find((c) => c.id === id),
    [state.clients],
  );
  const findCaseFn = useCallback(
    (id: string) => state.cases.find((c) => c.id === id),
    [state.cases],
  );
  const findUserFn = useCallback(
    (id: string) => state.users.find((u) => u.id === id),
    [state.users],
  );

  const caseLabel = useCallback((item: CaseFile) => `${item.no} • ${item.title}`, []);

  const clientOptions = useMemo(() => state.clients.map((c) => c.name), [state.clients]);
  const caseOptions = useMemo(() => state.cases.map(caseLabel), [state.cases, caseLabel]);
  const userOptions = useMemo(() => state.users.map((u) => u.name), [state.users]);

  const clientIdByName = useCallback(
    (name: string) => state.clients.find((c) => c.name === name)?.id,
    [state.clients],
  );
  const userIdByName = useCallback(
    (name: string) => state.users.find((u) => u.name === name)?.id,
    [state.users],
  );
  const caseIdByLabel = useCallback(
    (label: string) => state.cases.find((c) => caseLabel(c) === label)?.id,
    [state.cases, caseLabel],
  );

  const formatMoney = useCallback((n: number) => `₺${n.toLocaleString("tr-TR")}`, []);

  const searchAll = useCallback(
    (query: string) => {
      const q = query.trim().toLocaleLowerCase("tr");
      if (!q) return [];
      const results: Array<{
        id: string;
        title: string;
        subtitle: string;
        type: string;
        href: string;
      }> = [];

      for (const c of state.clients) {
        const hay = `${c.name} ${c.email} ${c.phone} ${c.kind}`.toLocaleLowerCase("tr");
        if (hay.includes(q)) {
          results.push({
            id: c.id,
            title: c.name,
            subtitle: `${c.kind} • ${c.email} • ${c.phone}`,
            type: "Müvekkil",
            href: "/muvekkiller",
          });
        }
      }
      for (const item of state.cases) {
        const client = findClientFn(item.clientId);
        const hay =
          `${item.no} ${item.title} ${item.court} ${item.type} ${client?.name ?? ""}`.toLocaleLowerCase(
            "tr",
          );
        if (hay.includes(q)) {
          results.push({
            id: item.id,
            title: `${item.no} • ${item.title}`,
            subtitle: `${client?.name ?? ""} • ${item.court} • ${item.stage}`,
            type: "Dosya",
            href: "/dosyalar",
          });
        }
      }
      for (const e of state.expenses) {
        const hay = `${e.title} ${e.type} ${e.status}`.toLocaleLowerCase("tr");
        if (hay.includes(q)) {
          results.push({
            id: e.id,
            title: e.title,
            subtitle: `${e.type} • ${formatMoney(e.amount)}`,
            type: "Masraf",
            href: "/masraflar",
          });
        }
      }
      for (const p of state.payments) {
        const caseFile = findCaseFn(p.caseId);
        const hay = `${p.description} ${p.type} ${caseFile?.no ?? ""}`.toLocaleLowerCase("tr");
        if (hay.includes(q)) {
          results.push({
            id: p.id,
            title: p.description,
            subtitle: `${caseFile ? caseLabel(caseFile) : ""} • ${formatMoney(p.amount)}`,
            type: "Tahsilat",
            href: "/tahsilatlar",
          });
        }
      }
      for (const r of state.reminders) {
        const hay = `${r.title} ${r.type}`.toLocaleLowerCase("tr");
        if (hay.includes(q)) {
          results.push({
            id: r.id,
            title: r.title,
            subtitle: `${r.type} • ${r.date}`,
            type: "Hatırlatma",
            href: "/hatirlatmalar",
          });
        }
      }
      for (const u of state.users) {
        const hay = `${u.name} ${u.email} ${u.role}`.toLocaleLowerCase("tr");
        if (hay.includes(q)) {
          results.push({
            id: u.id,
            title: u.name,
            subtitle: `${u.role} • ${u.email}`,
            type: "Kullanıcı",
            href: "/ayarlar",
          });
        }
      }
      return results;
    },
    [state, findClientFn, findCaseFn, caseLabel, formatMoney],
  );

  const value: ErpContextValue = {
    state,
    currentUser,
    permissions,
    isAuthenticated,
    hydrated,
    login,
    logout,
    setCurrentUserId,
    upsertUser,
    deleteUser,
    upsertClient,
    deleteClient,
    upsertCase,
    deleteCase,
    upsertExpense,
    deleteExpense,
    upsertPayment,
    deletePayment,
    upsertReminder,
    deleteReminder,
    addCategory,
    removeCategory,
    markNotificationRead,
    markAllNotificationsRead,
    findClient: findClientFn,
    findCase: findCaseFn,
    findUser: findUserFn,
    clientOptions,
    caseOptions,
    userOptions,
    caseIdByLabel,
    clientIdByName,
    userIdByName,
    caseLabel,
    formatMoney,
    searchAll,
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used within ErpProvider");
  return ctx;
}
