/**
 * Supabase veri yükleme ve CRUD yardımcıları.
 */
import { emptyState } from "@/lib/erp-data";
import type {
  CollectionKey,
  Collections,
  ErpState,
  FeePlan,
  SalaryGarnishment,
  Settings,
} from "@/lib/erp-types";
import {
  accountFromRow,
  accountToRow,
  attachmentFromRow,
  bankFromRow,
  bankToRow,
  salaryEntryFromRow,
  salaryGarnishmentFromRow,
  salaryGarnishmentToRow,
  caseFromRow,
  caseToRow,
  clientFromRow,
  clientToRow,
  collectionFromRow,
  collectionToRow,
  contactFromRow,
  contactToRow,
  debtorFromRow,
  debtorToRow,
  documentFromRow,
  documentToRow,
  enforcementFromRow,
  enforcementToRow,
  eventFromRow,
  eventToRow,
  expenseFromRow,
  expenseToRow,
  installmentFromRow,
  newId,
  notificationFromRow,
  notificationToRow,
  paymentFromRow,
  planFromRow,
  planToRow,
  profileToRow,
  promiseFromRow,
  promiseToRow,
  reminderFromRow,
  reminderToRow,
  settingsFromRow,
  settingsToRow,
  txFromRow,
  txToRow,
  userFromProfile,
  yearStatsFromRow,
} from "@/lib/mappers";
import { supabase } from "@/lib/supabase";
import type { Organization } from "@/lib/tenants";
import { STATE_VERSION } from "@/lib/erp-types";

export type LoadResult = {
  state: ErpState;
  organization: Organization;
};

function errMsg(e: { message?: string } | null, fallback = "Veritabanı hatası") {
  return e?.message || fallback;
}

/** Oturumdaki kullanıcının büro verisini yükler */
export async function loadFullState(): Promise<LoadResult | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr) throw new Error(errMsg(pErr));
  if (!profile) return null;

  const orgId = profile.org_id as string;

  const [
    orgRes,
    settingsRes,
    usersRes,
    clientsRes,
    casesRes,
    accountsRes,
    txsRes,
    debtorsRes,
    enfsRes,
    enfDebtorsRes,
    promisesRes,
    colsRes,
    contactsRes,
    expensesRes,
    attachmentsRes,
    plansRes,
    instRes,
    paysRes,
    remindersRes,
    docsRes,
    notifsRes,
    yearsRes,
    archiveRes,
    eventsRes,
    banksRes,
    salaryRes,
    salaryEntriesRes,
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("org_settings").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("profiles").select("*").eq("org_id", orgId),
    supabase.from("clients").select("*").eq("org_id", orgId),
    supabase.from("cases").select("*").eq("org_id", orgId),
    supabase.from("accounts").select("*").eq("org_id", orgId),
    supabase
      .from("account_transactions")
      .select("*")
      .eq("org_id", orgId)
      .order("date", { ascending: false }),
    supabase.from("debtors").select("*").eq("org_id", orgId),
    supabase.from("enforcements").select("*").eq("org_id", orgId),
    supabase.from("enforcement_debtors").select("*").eq("org_id", orgId),
    supabase.from("payment_promises").select("*").eq("org_id", orgId),
    supabase.from("collections").select("*").eq("org_id", orgId),
    supabase.from("contact_logs").select("*").eq("org_id", orgId),
    supabase.from("expenses").select("*").eq("org_id", orgId),
    supabase.from("attachments").select("*").eq("org_id", orgId),
    supabase.from("fee_plans").select("*").eq("org_id", orgId),
    supabase.from("installments").select("*").eq("org_id", orgId).order("position"),
    supabase.from("installment_payments").select("*").eq("org_id", orgId),
    supabase.from("reminders").select("*").eq("org_id", orgId),
    supabase.from("documents").select("*").eq("org_id", orgId),
    supabase
      .from("notifications")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("yearly_stats").select("*").eq("org_id", orgId),
    supabase.from("org_archive").select("*").eq("org_id", orgId).maybeSingle(),
    // 20261016 migration'ı çalıştırılmadıysa tablo yoktur: hata yükü durdurmaz, liste boş gelir
    supabase
      .from("enforcement_events")
      .select("*")
      .eq("org_id", orgId)
      .order("date", { ascending: false }),
    supabase.from("banks").select("*").eq("org_id", orgId).order("name"),
    supabase.from("salary_garnishments").select("*").eq("org_id", orgId).order("employee_name"),
    supabase.from("salary_garnishment_entries").select("*").eq("org_id", orgId).order("position"),
  ]);
  if (eventsRes.error) console.warn("İcra işlem geçmişi yüklenemedi:", eventsRes.error.message);
  if (banksRes.error) console.warn("Banka listesi yüklenemedi:", banksRes.error.message);
  if (salaryRes.error) console.warn("Maaş haczi sıraları yüklenemedi:", salaryRes.error.message);
  if (salaryEntriesRes.error)
    console.warn("Maaş haczi dosyaları yüklenemedi:", salaryEntriesRes.error.message);

  const firstErr = [
    orgRes,
    settingsRes,
    usersRes,
    clientsRes,
    casesRes,
    accountsRes,
    txsRes,
    debtorsRes,
    enfsRes,
    enfDebtorsRes,
    promisesRes,
    colsRes,
    contactsRes,
    expensesRes,
    attachmentsRes,
    plansRes,
    instRes,
    paysRes,
    remindersRes,
    docsRes,
    notifsRes,
    yearsRes,
    archiveRes,
  ].find((r) => r.error)?.error;
  if (firstErr) throw new Error(errMsg(firstErr));

  const attachments = (attachmentsRes.data ?? []).map((r) => ({
    row: r as Record<string, unknown>,
    ref: attachmentFromRow(r as Record<string, unknown>),
  }));
  const attById = new Map(attachments.map((a) => [a.ref.id, a.ref]));
  const expenseReceipts = new Map<string, (typeof attachments)[0]["ref"][]>();
  for (const a of attachments) {
    if (a.row.entity === "expense" && a.row.entity_id) {
      const eid = String(a.row.entity_id);
      const list = expenseReceipts.get(eid) ?? [];
      list.push(a.ref);
      expenseReceipts.set(eid, list);
    }
  }

  const paysByInst = new Map<string, ReturnType<typeof paymentFromRow>[]>();
  for (const p of paysRes.data ?? []) {
    const row = p as Record<string, unknown>;
    const iid = String(row.installment_id);
    const list = paysByInst.get(iid) ?? [];
    list.push(paymentFromRow(row));
    paysByInst.set(iid, list);
  }

  const instByPlan = new Map<string, ReturnType<typeof installmentFromRow>[]>();
  for (const i of instRes.data ?? []) {
    const row = i as Record<string, unknown>;
    const pid = String(row.plan_id);
    const list = instByPlan.get(pid) ?? [];
    list.push(installmentFromRow(row, paysByInst.get(String(row.id)) ?? []));
    instByPlan.set(pid, list);
  }

  const debtorIdsByEnf = new Map<string, string[]>();
  for (const ed of enfDebtorsRes.data ?? []) {
    const row = ed as Record<string, unknown>;
    const eid = String(row.enforcement_id);
    const list = debtorIdsByEnf.get(eid) ?? [];
    list.push(String(row.debtor_id));
    debtorIdsByEnf.set(eid, list);
  }

  const years: Record<string, ReturnType<typeof yearStatsFromRow>["stats"]> = {};
  for (const y of yearsRes.data ?? []) {
    const { year, stats } = yearStatsFromRow(y as Record<string, unknown>);
    years[String(year)] = stats;
  }

  const org = orgRes.data as Record<string, unknown>;
  const state: ErpState = {
    version: STATE_VERSION,
    firmId: orgId,
    settings: settingsFromRow(settingsRes.data as Record<string, unknown> | null),
    archive: {
      years,
      archivedThrough: (archiveRes.data as { archived_through?: number } | null)?.archived_through,
    },
    users: (usersRes.data ?? []).map((r) => userFromProfile(r as Record<string, unknown>)),
    clients: (clientsRes.data ?? []).map((r) => clientFromRow(r as Record<string, unknown>)),
    cases: (casesRes.data ?? []).map((r) => caseFromRow(r as Record<string, unknown>)),
    accounts: (accountsRes.data ?? []).map((r) => accountFromRow(r as Record<string, unknown>)),
    transactions: (txsRes.data ?? []).map((r) => txFromRow(r as Record<string, unknown>)),
    debtors: (debtorsRes.data ?? []).map((r) => debtorFromRow(r as Record<string, unknown>)),
    enforcements: (enfsRes.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return enforcementFromRow(row, debtorIdsByEnf.get(String(row.id)) ?? []);
    }),
    promises: (promisesRes.data ?? []).map((r) => promiseFromRow(r as Record<string, unknown>)),
    collections: (colsRes.data ?? []).map((r) => collectionFromRow(r as Record<string, unknown>)),
    contacts: (contactsRes.data ?? []).map((r) => contactFromRow(r as Record<string, unknown>)),
    events: eventsRes.error
      ? []
      : (eventsRes.data ?? []).map((r) => eventFromRow(r as Record<string, unknown>)),
    banks: banksRes.error
      ? []
      : (banksRes.data ?? []).map((r) => bankFromRow(r as Record<string, unknown>)),
    salaryGarnishments: (() => {
      if (salaryRes.error || salaryEntriesRes.error) return [];
      const byQueue = new Map<string, ReturnType<typeof salaryEntryFromRow>[]>();
      for (const row of salaryEntriesRes.data ?? []) {
        const r = row as Record<string, unknown>;
        const qid = String(r.queue_id);
        const list = byQueue.get(qid) ?? [];
        list.push(salaryEntryFromRow(r));
        byQueue.set(qid, list);
      }
      return (salaryRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return salaryGarnishmentFromRow(r, byQueue.get(String(r.id)) ?? []);
      });
    })(),
    expenses: (expensesRes.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return expenseFromRow(row, expenseReceipts.get(String(row.id)) ?? []);
    }),
    plans: (plansRes.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return planFromRow(row, instByPlan.get(String(row.id)) ?? []);
    }),
    reminders: (remindersRes.data ?? []).map((r) => reminderFromRow(r as Record<string, unknown>)),
    documents: (docsRes.data ?? [])
      .map((r) => {
        const row = r as Record<string, unknown>;
        const att = attById.get(String(row.attachment_id));
        if (!att) return null;
        return documentFromRow(row, att);
      })
      .filter(Boolean) as ErpState["documents"],
    notifications: (notifsRes.data ?? []).map((r) =>
      notificationFromRow(r as Record<string, unknown>),
    ),
  };

  const organization: Organization = {
    id: orgId,
    name: String(org.name ?? state.settings.firm.name),
    createdAt: String(org.created_at ?? ""),
    active: org.active !== false,
  };

  return { state, organization };
}

export function blankState(): ErpState {
  return emptyState();
}

/* ───── Table map ───── */

const TABLE: Partial<Record<CollectionKey, string>> = {
  users: "profiles",
  clients: "clients",
  cases: "cases",
  accounts: "accounts",
  transactions: "account_transactions",
  debtors: "debtors",
  enforcements: "enforcements",
  promises: "payment_promises",
  collections: "collections",
  contacts: "contact_logs",
  events: "enforcement_events",
  banks: "banks",
  salaryGarnishments: "salary_garnishments",
  expenses: "expenses",
  reminders: "reminders",
  documents: "documents",
  notifications: "notifications",
};

type ToRowFn = (item: Record<string, unknown>) => Record<string, unknown>;

const TO_ROW: Partial<Record<CollectionKey, ToRowFn>> = {
  users: (u) => profileToRow(u as never),
  clients: (c) => clientToRow(c as never),
  cases: (c) => caseToRow(c as never),
  accounts: (a) => accountToRow(a as never),
  transactions: (t) => txToRow(t as never),
  debtors: (d) => debtorToRow(d as never),
  enforcements: (e) => enforcementToRow(e as never),
  promises: (p) => promiseToRow(p as never),
  collections: (c) => collectionToRow(c as never),
  contacts: (c) => contactToRow(c as never),
  events: (e) => eventToRow(e as never),
  banks: (b) => bankToRow(b as never),
  salaryGarnishments: (q) => salaryGarnishmentToRow(q as never),
  expenses: (e) => expenseToRow(e as never),
  reminders: (r) => reminderToRow(r as never),
  documents: (d) => documentToRow(d as never),
  notifications: (n) => notificationToRow(n as never),
};

async function syncSalaryEntries(queue: SalaryGarnishment) {
  // position unique: sil-yeniden yaz (sıra değişiminde çakışma olmasın)
  const { error: delErr } = await supabase
    .from("salary_garnishment_entries")
    .delete()
    .eq("queue_id", queue.id);
  if (delErr) throw new Error(errMsg(delErr));
  if (!queue.entries.length) return;
  const rows = queue.entries.map((e, i) => ({
    id: e.id,
    queue_id: queue.id,
    position: i + 1,
    office: e.office.trim(),
    file_no: e.fileNo.trim(),
    notified_at: e.notifiedAt || null,
    note: e.note || null,
  }));
  const { error } = await supabase.from("salary_garnishment_entries").insert(rows);
  if (error) throw new Error(errMsg(error));
}

async function syncEnforcementDebtors(enforcementId: string, debtorIds: string[]) {
  await supabase.from("enforcement_debtors").delete().eq("enforcement_id", enforcementId);
  if (!debtorIds.length) return;
  const { error } = await supabase
    .from("enforcement_debtors")
    .insert(debtorIds.map((debtor_id) => ({ enforcement_id: enforcementId, debtor_id })));
  if (error) throw new Error(errMsg(error));
}

async function syncFeePlan(plan: FeePlan) {
  const row = { id: plan.id, ...planToRow(plan) };
  const { error } = await supabase.from("fee_plans").upsert(row);
  if (error) throw new Error(errMsg(error));

  const { data: existing } = await supabase
    .from("installments")
    .select("id")
    .eq("plan_id", plan.id);
  const keep = new Set(plan.installments.map((i) => i.id));
  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error: dErr } = await supabase.from("installments").delete().in("id", toDelete);
    if (dErr) throw new Error(errMsg(dErr));
  }

  // Taksitler ve ödemeler tek istekte toplu yazılır (taksit başına ayrı istek yok)
  if (!plan.installments.length) return;
  const { error: iErr } = await supabase.from("installments").upsert(
    plan.installments.map((inst, i) => ({
      id: inst.id,
      plan_id: plan.id,
      position: i + 1,
      due_date: inst.dueDate,
      amount: inst.amount,
    })),
  );
  if (iErr) throw new Error(errMsg(iErr));

  const { data: existingPays } = await supabase
    .from("installment_payments")
    .select("id")
    .in(
      "installment_id",
      plan.installments.map((i) => i.id),
    );
  const pays = plan.installments.flatMap((inst) =>
    inst.payments.map((pay) => ({
      id: pay.id,
      installment_id: inst.id,
      date: pay.date,
      amount: pay.amount,
      method: pay.method,
      account_id: pay.accountId || null,
      note: pay.note || null,
    })),
  );
  const keepPay = new Set(pays.map((p) => p.id));
  const delPay = (existingPays ?? []).map((r) => r.id as string).filter((id) => !keepPay.has(id));
  if (delPay.length) {
    const { error: dpErr } = await supabase.from("installment_payments").delete().in("id", delPay);
    if (dpErr) throw new Error(errMsg(dpErr));
  }
  if (pays.length) {
    const { error: pErr } = await supabase.from("installment_payments").upsert(pays);
    if (pErr) throw new Error(errMsg(pErr));
  }
}

async function syncExpenseReceipts(expenseId: string, receipts: { id: string }[]) {
  const ids = receipts.map((r) => r.id);
  if (ids.length) {
    const { error } = await supabase
      .from("attachments")
      .update({ entity: "expense", entity_id: expenseId })
      .in("id", ids);
    if (error) throw new Error(errMsg(error));
  }
  // Bağlantısı kopan makbuzları entity_id temizle
  const { data: linked } = await supabase
    .from("attachments")
    .select("id")
    .eq("entity", "expense")
    .eq("entity_id", expenseId);
  const keep = new Set(ids);
  const orphan = (linked ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));
  if (orphan.length) {
    await supabase.from("attachments").delete().in("id", orphan);
  }
}

/** Kaydı Supabase'e yazar (upsert). */
export async function persistSave<K extends CollectionKey>(
  key: K,
  item: Collections[K],
): Promise<void> {
  await persistSaveMany(key, [item]);
}

const IMPORT_BATCH_KEYS = [
  "clients",
  "debtors",
  "banks",
  "cases",
  "expenses",
  "enforcements",
  "reminders",
] as const;

type ImportBatchKey = (typeof IMPORT_BATCH_KEYS)[number];

/** Excel aktarımı: tek RPC ile JSON batch (PostgREST satır satır yazmaz). */
export async function persistImportBatch(
  batch: Partial<{ [K in ImportBatchKey]: Collections[K][] }>,
): Promise<{ total: number; counts: Record<string, number> }> {
  const payload: Record<string, unknown[]> = {};
  let prepared = 0;

  for (const key of IMPORT_BATCH_KEYS) {
    const items = batch[key];
    if (!items?.length) continue;
    if (key === "enforcements") {
      payload.enforcements = (items as Collections["enforcements"][]).map((e) => ({
        id: e.id,
        ...enforcementToRow(e),
        debtor_ids: e.debtorIds ?? [],
      }));
    } else {
      const toRow = TO_ROW[key];
      if (!toRow) continue;
      payload[key] = items.map((item) => ({
        id: item.id,
        ...toRow(item as unknown as Record<string, unknown>),
      }));
    }
    prepared += items.length;
  }

  if (!prepared) return { total: 0, counts: {} };

  const { data, error } = await supabase.rpc("import_batch", { p_payload: payload });
  if (error) throw new Error(errMsg(error));
  const counts = (data ?? {}) as Record<string, number>;
  return { total: Number(counts.total ?? prepared), counts };
}

const UPSERT_CHUNK = 250;

/** Toplu upsert (aktarım). enforcements için borçlu eşlemesi de gruplanır. */
export async function persistSaveMany<K extends CollectionKey>(
  key: K,
  items: Collections[K][],
): Promise<void> {
  if (!items.length) return;

  if (key === "plans") {
    for (const item of items) await syncFeePlan(item as FeePlan);
    return;
  }

  const table = TABLE[key];
  const toRow = TO_ROW[key];
  if (!table || !toRow) throw new Error(`Desteklenmeyen koleksiyon: ${key}`);

  if (key === "salaryGarnishments") {
    for (const item of items) {
      const q = item as SalaryGarnishment;
      const row = { id: q.id, ...salaryGarnishmentToRow(q) };
      const { error } = await supabase.from("salary_garnishments").upsert(row);
      if (error) throw new Error(errMsg(error));
      await syncSalaryEntries(q);
    }
    return;
  }

  if (key === "users") {
    for (const item of items) {
      const row = { id: item.id, ...toRow(item as unknown as Record<string, unknown>) };
      const { id, ...changes } = row;
      const { data, error } = await supabase
        .from("profiles")
        .update(changes)
        .eq("id", id)
        .select("id");
      if (error) throw new Error(errMsg(error));
      if (!data?.length)
        throw new Error("Kullanıcı güncellenemedi: yetkiniz yok ya da kayıt bulunamadı");
    }
    return;
  }

  for (let i = 0; i < items.length; i += UPSERT_CHUNK) {
    const slice = items.slice(i, i + UPSERT_CHUNK);
    const rows = slice.map((item) => ({
      id: item.id,
      ...toRow(item as unknown as Record<string, unknown>),
    }));
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw new Error(errMsg(error));
  }

  if (key === "enforcements") {
    const enfItems = items as Collections["enforcements"][];
    const ids = enfItems.map((e) => e.id);
    if (ids.length) {
      const { error: delErr } = await supabase
        .from("enforcement_debtors")
        .delete()
        .in("enforcement_id", ids);
      if (delErr) throw new Error(errMsg(delErr));
      const links = enfItems.flatMap((e) =>
        (e.debtorIds ?? []).map((debtor_id) => ({ enforcement_id: e.id, debtor_id })),
      );
      if (links.length) {
        for (let j = 0; j < links.length; j += UPSERT_CHUNK) {
          const { error: insErr } = await supabase
            .from("enforcement_debtors")
            .insert(links.slice(j, j + UPSERT_CHUNK));
          if (insErr) throw new Error(errMsg(insErr));
        }
      }
    }
  }
  if (key === "expenses") {
    for (const item of items) {
      await syncExpenseReceipts(item.id, (item as Collections["expenses"]).receipts ?? []);
    }
  }
}

export async function persistRemove(key: CollectionKey, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (key === "plans") {
    const { error } = await supabase.from("fee_plans").delete().in("id", ids);
    if (error) throw new Error(errMsg(error));
    return;
  }
  const table = TABLE[key];
  if (!table) return;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw new Error(errMsg(error));
}

export async function persistSettings(orgId: string, patch: Partial<Settings>): Promise<void> {
  const row = settingsToRow(patch);
  if (!Object.keys(row).length) return;
  // upsert değil update: org_settings satırı büro kurulurken oluşur ve tabloda yalnızca
  // select/update politikası vardır (insert politikası olmadığı için upsert RLS'e takılırdı).
  const { data, error } = await supabase
    .from("org_settings")
    .update(row)
    .eq("org_id", orgId)
    .select("org_id");
  if (error) throw new Error(errMsg(error));
  if (!data?.length)
    throw new Error("Ayarlar kaydedilemedi: yönetici yetkisi gerekli veya ayar satırı yok");
}

export async function persistOrgName(orgId: string, name: string): Promise<void> {
  const { error } = await supabase.from("organizations").update({ name }).eq("id", orgId);
  if (error) throw new Error(errMsg(error));
}

export { newId };
