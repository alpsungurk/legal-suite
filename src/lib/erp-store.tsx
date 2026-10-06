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
              role:
                String(existing.role) === "Stajyer"
                  ? seedUser.role
                  : existing.role || seedUser.role,
            }
          : seedUser;
      }),
      ...(parsed.users ?? []).filter(
        (u) => !seedById.has(u.id) && u.username && String(u.role) !== "Stajyer",
      ),
    ];
    const seedClientIds = new Set(seed.clients.map((client) => client.id));
    const normalizedClients = [
      ...seed.clients.map((seedClient) => ({
        ...seedClient,
        ...parsed.clients?.find((client) => client.id === seedClient.id),
      })),
      ...(parsed.clients ?? []).filter((client) => !seedClientIds.has(client.id)),
    ];
    const normalizedCases = (parsed.cases ?? seed.cases).map((item) => {
      const caseFile = { ...item } as CaseFile & { responsibleId?: string; stage?: string };
      delete caseFile.responsibleId;
      delete caseFile.stage;
      return caseFile;
    });
    const normalizedPayments = (parsed.payments ?? seed.payments).map((payment) =>
      payment.installments?.length === 1 ? { ...payment, installments: undefined } : payment,
    );
    const seedExpensesById = new Map(seed.expenses.map((expense) => [expense.id, expense]));
    const normalizedExpenses = (parsed.expenses ?? seed.expenses).map((expense) => {
      if (expense.type !== "Yasal vekalet ücreti") return expense;
      const seedExpense = seedExpensesById.get(expense.id);
      if (!seedExpense) return { ...expense, type: "Diğer" };
      return {
        ...expense,
        title: expense.title === "Yasal vekalet ücreti" ? seedExpense.title : expense.title,
        type: seedExpense.type,
      };
    });
    return {
      ...seed,
      ...parsed,
      users: mergedUsers.length ? mergedUsers : seed.users,
      clients: normalizedClients,
      cases: normalizedCases,
      expenses: normalizedExpenses,
      payments: normalizedPayments,
      caseTypes: parsed.caseTypes?.length ? parsed.caseTypes : seed.caseTypes,
      expenseTypes: [
        ...new Set([
          ...seed.expenseTypes,
          ...(parsed.expenseTypes ?? []).filter((type) => type !== "Yasal vekalet ücreti"),
          ...(parsed.expenses ?? []).map((expense) => expense.type),
        ]),
      ],
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
  markInstallmentPaid: (paymentId: string, installmentId: string) => void;
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
        const list = prev[key] as unknown as T[];
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
      mutateList("cases", item, isNew, `${item.no} • ${item.title}`, "Dosya");
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
        let next: ErpState = { ...prev, expenses: list };
        next = pushActivity(
          next,
          isNew ? "Masraf eklendi" : "Masraf güncellendi",
          "Masraf",
          item.title,
          undefined,
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
        let next: ErpState = { ...prev, payments: list };
        next = pushActivity(
          next,
          isNew ? "Tahsilat eklendi" : "Tahsilat güncellendi",
          "Tahsilat",
          item.description || item.id,
          undefined,
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

  const markInstallmentPaid = useCallback(
    (paymentId: string, installmentId: string) => {
      setState((prev) => {
        const payment = prev.payments.find((item) => item.id === paymentId);
        if (!payment?.installments) return prev;
        const installments = payment.installments.map((installment) =>
          installment.id === installmentId
            ? { ...installment, status: "Ödendi" as const }
            : installment,
        );
        const paymentStatus = installments.every((installment) => installment.status === "Ödendi")
          ? "Tamamlandı"
          : "Beklemede";
        const nextPayments = prev.payments.map((item) =>
          item.id === paymentId ? { ...item, installments, status: paymentStatus } : item,
        );
        return pushActivity(
          { ...prev, payments: nextPayments },
          "Taksit tahsil edildi",
          "Tahsilat",
          `${payment.description} • ${installmentId}`,
        );
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
    markInstallmentPaid,
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
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used within ErpProvider");
  return ctx;
}