/**
 * Kayıtlı veriyi güncel şemaya taşır. Her sürüm değişikliğinde buraya bir adım eklenir.
 */
import { createSeedState, defaultSettings, emptyState, FIRM_ID } from "@/lib/erp-data";
import {
  STATE_VERSION,
  type CaseFile,
  type Client,
  type CollectionKey,
  type ErpState,
  type Expense,
  type FeePlan,
  type Reminder,
  type User,
} from "@/lib/erp-types";
import { round2, today } from "@/lib/format";

export const STORAGE_KEY = "lex-erp-state-v3";
export const LEGACY_STORAGE_KEY = "lex-erp-state-v2";

const SEED_SALT = "lexseed0000000000000000000000001";
const SEED_HASH = "7e8a30ccccd27dc77394c5edd467ab138148581f5e84b5a22e355825628e183e";

type Legacy = Record<string, unknown> & {
  users?: Array<Record<string, unknown>>;
  clients?: Array<Record<string, unknown>>;
  cases?: Array<Record<string, unknown>>;
  expenses?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  reminders?: Array<Record<string, unknown>>;
  caseTypes?: string[];
  expenseTypes?: string[];
  reminderTypes?: string[];
};

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** v2 (eski düz yapı) → v3 */
export function migrateLegacy(old: Legacy): ErpState {
  const seed = createSeedState();
  const stamp = new Date().toISOString();
  const base = { firmId: FIRM_ID, createdAt: stamp, updatedAt: stamp };
  const state = emptyState();

  const users: User[] = (old.users ?? []).map((u) => ({
    ...base,
    id: str(u.id),
    name: str(u.name),
    role: (["Admin", "Avukat", "Sekreter"].includes(str(u.role))
      ? u.role
      : "Avukat") as User["role"],
    email: str(u.email),
    username: str(u.username) || str(u.name).toLocaleLowerCase("tr").replace(/\s+/g, ""),
    active: true,
    passwordHash: SEED_HASH,
    passwordSalt: SEED_SALT,
  }));
  // Demo müvekkil kullanıcısını ekle (yoksa)
  for (const su of seed.users) if (!users.some((u) => u.username === su.username)) users.push(su);

  const clients: Client[] = (old.clients ?? []).map((c) => ({
    ...base,
    id: str(c.id),
    name: str(c.name),
    kind: c.kind === "Kurumsal" ? "Kurumsal" : "Bireysel",
    email: str(c.email),
    phone: str(c.phone),
    status: c.status === "Pasif" ? "Pasif" : "Aktif",
    identity: str(c.identity) || undefined,
    address: str(c.address) || undefined,
    monthlyFee: c.monthlyFee ? num(c.monthlyFee) : undefined,
    monthlyFeeStartDate: str(c.monthlyFeeStartDate) || undefined,
    portalEnabled: str(c.id) === "cli-ayse",
    portalShowStatement: true,
  }));

  const cases: CaseFile[] = (old.cases ?? []).map((c) => ({
    ...base,
    id: str(c.id),
    no: str(c.no),
    title: str(c.title),
    clientId: str(c.clientId) || undefined,
    court: str(c.court) || undefined,
    type: str(c.type, "Dava"),
    status: "Derdest",
    responsibleIds: [],
    openingDate: str(c.openingDate, today()),
    note: str(c.note) || undefined,
    portalVisible: true,
  }));

  const expenses: Expense[] = [];
  for (const e of old.expenses ?? []) {
    const incoming = e.direction === "Gelen" || (!e.direction && e.payer === "Müvekkil");
    if (incoming) {
      // Eski "gelen masraf" kaydı = müvekkilden alınan masraf parası → avans
      if (e.status === "Alındı" && (e.clientId || e.caseId)) {
        const clientId = str(e.clientId) || cases.find((c) => c.id === e.caseId)?.clientId || "";
        if (clientId)
          state.advances.push({
            ...base,
            id: `adv-${str(e.id)}`,
            kind: "Avans",
            clientId,
            caseId: str(e.caseId) || undefined,
            amount: num(e.amount),
            date: str(e.recordDate) || str(e.date, today()),
            method: "Havale/EFT",
            note: str(e.title),
          });
      }
      continue;
    }
    expenses.push({
      ...base,
      id: str(e.id),
      title: str(e.title),
      type: str(e.type, "Diğer"),
      amount: num(e.amount),
      date: str(e.date, today()),
      caseId: str(e.caseId) || undefined,
      clientId: str(e.clientId) || undefined,
      chargeTo: e.caseId || e.clientId ? "Müvekkil" : "Büro",
      paidBy: e.payer === "Müvekkil" ? "Müvekkil" : "Büro",
      receipts: [],
      createdBy: users[0]?.id ?? "",
    });
  }

  const plans: FeePlan[] = [];
  for (const p of old.payments ?? []) {
    const clientId = str(p.clientId) || cases.find((c) => c.id === p.caseId)?.clientId || "";
    if (!clientId) continue;
    const date = str(p.date, today());
    const done = p.status === "Tamamlandı";
    const legacyInst = Array.isArray(p.installments)
      ? (p.installments as Array<Record<string, unknown>>)
      : [];
    const installments = legacyInst.length
      ? legacyInst.map((i, idx) => ({
          id: str(i.id) || `${str(p.id)}-${idx + 1}`,
          dueDate: str(i.dueDate, date),
          amount: num(i.amount),
          payments:
            i.status === "Ödendi"
              ? [
                  {
                    id: `${str(i.id)}-pay`,
                    date: str(i.dueDate, date),
                    amount: num(i.amount),
                    method: "Havale/EFT" as const,
                  },
                ]
              : [],
        }))
      : [
          {
            id: `${str(p.id)}-1`,
            dueDate: date,
            amount: num(p.amount),
            payments: done
              ? [
                  {
                    id: `${str(p.id)}-pay`,
                    date,
                    amount: num(p.amount),
                    method: "Havale/EFT" as const,
                  },
                ]
              : [],
          },
        ];
    plans.push({
      ...base,
      id: str(p.id),
      title: str(p.description, "Vekalet ücreti"),
      kind: p.feePeriod ? "Aylık ücret" : "Vekalet ücreti",
      clientId,
      caseId: str(p.caseId) || undefined,
      date,
      total: round2(num(p.amount)),
      installments,
      period: str(p.feePeriod) || undefined,
      cancelled: p.status === "İptal",
    });
  }

  const reminders: Reminder[] = (old.reminders ?? []).map((r) => ({
    ...base,
    id: str(r.id),
    title: str(r.title),
    type: str(r.type, "Diğer"),
    date: str(r.date, today()),
    caseId: str(r.caseId) || undefined,
    clientId: str(r.clientId) || undefined,
    assigneeId: str(r.assigneeId, users[0]?.id ?? ""),
    status: r.status === "Tamamlandı" ? "Tamamlandı" : "Bekliyor",
    note: str(r.note) || undefined,
    portalVisible: false,
  }));

  const settings = defaultSettings();
  if (old.caseTypes?.length) settings.caseTypes = old.caseTypes;
  if (old.expenseTypes?.length)
    settings.expenseTypes = [...new Set([...settings.expenseTypes, ...old.expenseTypes])];
  if (old.reminderTypes?.length)
    settings.reminderTypes = [...new Set([...settings.reminderTypes, ...old.reminderTypes])];

  return normalizeState({
    ...state,
    settings,
    users: users.length ? users : seed.users,
    clients,
    cases,
    expenses,
    plans,
    reminders,
    // Yeni modüller (banka/kasa, icra, portal) mevcut müvekkillerle eşleşen demo kayıtlarıyla başlar
    ...seedNewModules(seed, new Set(clients.map((c) => c.id))),
  });
}

function seedNewModules(seed: ErpState, clientIds: Set<string>) {
  const enforcements = seed.enforcements.filter((e) => clientIds.has(e.clientId));
  const enfIds = new Set(enforcements.map((e) => e.id));
  const debtorIds = new Set(enforcements.flatMap((e) => e.debtorIds));
  return {
    accounts: seed.accounts,
    transactions: seed.transactions.filter((t) => !t.clientId || clientIds.has(t.clientId)),
    debtors: seed.debtors.filter((d) => debtorIds.has(d.id)),
    enforcements,
    promises: seed.promises.filter((p) => enfIds.has(p.enforcementId)),
    collections: seed.collections.filter((c) => enfIds.has(c.enforcementId)),
    contacts: seed.contacts.filter((c) => !c.enforcementId || enfIds.has(c.enforcementId)),
    docRequests: seed.docRequests.filter((r) => clientIds.has(r.clientId)),
    messages: seed.messages.filter((m) => clientIds.has(m.clientId)),
  };
}

const COLLECTION_KEYS: CollectionKey[] = [
  "users",
  "clients",
  "cases",
  "expenses",
  "advances",
  "plans",
  "accounts",
  "transactions",
  "reminders",
  "debtors",
  "enforcements",
  "promises",
  "collections",
  "contacts",
  "documents",
  "docRequests",
  "messages",
  "notifications",
  "activities",
];

/** Eksik koleksiyon/alanları doldurur; içe aktarılan yedekler için de kullanılır. */
export function normalizeState(input: Partial<ErpState>): ErpState {
  const empty = emptyState();
  const out = { ...empty, ...input, version: STATE_VERSION } as ErpState;
  for (const key of COLLECTION_KEYS) {
    if (!Array.isArray(out[key])) (out as Record<string, unknown>)[key] = [];
  }
  out.settings = {
    ...empty.settings,
    ...(input.settings ?? {}),
    firm: { ...empty.settings.firm, ...(input.settings?.firm ?? {}) },
  };
  return out;
}

export function loadPersistedState(): ErpState {
  if (typeof window === "undefined") return createSeedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ErpState;
      return normalizeState(parsed);
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy) as Legacy);
  } catch (err) {
    console.error("Kayıtlı veri okunamadı, demo verisiyle başlanıyor", err);
  }
  return createSeedState();
}
