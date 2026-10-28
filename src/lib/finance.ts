/**
 * State'ten türetilen finans hesapları. Hepsi saf fonksiyondur; hiçbir şey
 * saklanmaz, böylece veriler her zaman tutarlı kalır.
 */
import type {
  AccountTx,
  CaseFile,
  Collection,
  EnforcementFile,
  ErpState,
  Expense,
  FeePlan,
  Installment,
  ISODate,
  PaymentPromise,
  User,
  YearStats,
} from "@/lib/erp-types";
import {
  EVENT_TYPE_ADD_DEBTOR,
  EVENT_TYPE_BANK_891,
  EVENT_TYPE_BANK_892,
  EVENT_TYPE_BANK_893,
  EVENT_TYPE_EVICTION,
  EVENT_TYPE_FINALIZED,
  EVENT_TYPE_SALARY,
  EVENT_TYPE_SERVICE,
  bankHasAnswer,
  isEnforcementInactive,
  normalizeBankAnswers,
} from "@/lib/erp-types";
import {
  addDays,
  addMonths,
  daysFromToday,
  formatMoney,
  monthKey,
  round2,
  sum,
  sumBy,
  today,
} from "@/lib/format";

/* ───────────── İlişki yardımcıları ───────────── */

export function caseClientId(state: ErpState, caseId?: string) {
  if (!caseId) return undefined;
  return state.cases.find((c) => c.id === caseId)?.clientId;
}

export function recordClientId(state: ErpState, rec: { clientId?: string; caseId?: string }) {
  return rec.clientId ?? caseClientId(state, rec.caseId);
}

/** Dosya no + mahkeme adı (mahkeme yoksa konu). */
export function caseCourtLabel(c: CaseFile) {
  return `${c.no} · ${c.court || c.title}`;
}

export function caseLabel(c?: CaseFile) {
  return c ? `${c.no} · ${c.title}` : "Dosyasız";
}

/* ───────────── Taksitler ───────────── */

export type InstallmentStatus = "Ödendi" | "Kısmi" | "Gecikmiş" | "Bekliyor";

export function installmentPaid(inst: Installment) {
  return sumBy(inst.payments, (p) => p.amount);
}

export function installmentRemaining(inst: Installment) {
  return Math.max(round2(inst.amount - installmentPaid(inst)), 0);
}

export function installmentStatus(inst: Installment): InstallmentStatus {
  const paid = installmentPaid(inst);
  if (paid >= inst.amount - 0.005) return "Ödendi";
  if (inst.dueDate < today()) return "Gecikmiş";
  if (paid > 0) return "Kısmi";
  return "Bekliyor";
}

export type PlanStatus = "Tamamlandı" | "Gecikmiş" | "Devam ediyor" | "İptal";

export function planSummary(plan: FeePlan) {
  const paid = sum(plan.installments.map(installmentPaid));
  const remaining = Math.max(round2(plan.total - paid), 0);
  const open = plan.installments.filter((i) => installmentStatus(i) !== "Ödendi");
  const overdue = open.filter((i) => installmentStatus(i) === "Gecikmiş");
  const overdueAmount = sumBy(overdue, installmentRemaining);
  const next = [...open].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const status: PlanStatus = plan.cancelled
    ? "İptal"
    : remaining <= 0.005
      ? "Tamamlandı"
      : overdue.length
        ? "Gecikmiş"
        : "Devam ediyor";
  const lastPayment = plan.installments
    .flatMap((i) => i.payments)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    paid,
    remaining,
    overdueAmount,
    overdueCount: overdue.length,
    next,
    status,
    lastPayment,
    progress: plan.total > 0 ? Math.min(paid / plan.total, 1) : 0,
  };
}

export type InstallmentRow = {
  plan: FeePlan;
  inst: Installment;
  index: number;
  status: InstallmentStatus;
  remaining: number;
  paid: number;
};

export function allInstallments(state: ErpState): InstallmentRow[] {
  return state.plans
    .filter((p) => !p.cancelled)
    .flatMap((plan) =>
      plan.installments.map((inst, index) => ({
        plan,
        inst,
        index,
        status: installmentStatus(inst),
        remaining: installmentRemaining(inst),
        paid: installmentPaid(inst),
      })),
    )
    .sort((a, b) => a.inst.dueDate.localeCompare(b.inst.dueDate));
}

/**
 * Taksite ödeme uygular; taksit tutarını aşan kısım sıradaki açık taksitlere aktarılır.
 * Planın tamamını aşan fazla tutar son taksite yazılır.
 */
export function applyPaymentToPlan(
  plan: FeePlan,
  installmentId: string,
  payment: Omit<Installment["payments"][number], "id" | "amount"> & { amount: number },
  newId: () => string,
): FeePlan {
  let left = round2(payment.amount);
  const startIndex = Math.max(
    plan.installments.findIndex((i) => i.id === installmentId),
    0,
  );
  const order = [
    ...plan.installments.slice(startIndex),
    ...plan.installments.slice(0, startIndex),
  ].map((i) => i.id);
  const byId = new Map(plan.installments.map((i) => [i.id, { ...i, payments: [...i.payments] }]));
  for (const id of order) {
    if (left <= 0) break;
    const inst = byId.get(id)!;
    const room = installmentRemaining(inst);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    inst.payments.push({ ...payment, id: newId(), amount: round2(take) });
    left = round2(left - take);
  }
  if (left > 0) {
    const last = byId.get(order[order.length - 1])!;
    last.payments.push({ ...payment, id: newId(), amount: left });
  }
  return { ...plan, installments: plan.installments.map((i) => byId.get(i.id)!) };
}

/* ───────────── Masraflar ───────────── */

/** Müvekkile yansıyan ve büronun ödediği masraf: müvekkilin carisine borç yazılır. */
export function isClientCharged(e: Expense) {
  return e.chargeTo === "Müvekkil" && e.paidBy === "Büro";
}

/** Müvekkile yansıyan ve müvekkilin henüz geri ödemediği masraf */
export function isOutstandingCharge(e: Expense) {
  return isClientCharged(e) && !e.reimbursedOn;
}

/** Büronun cebinden çıkan net tutar: müvekkilin geri ödediği masraf 0 sayılır */
export function expenseNetCost(e: Expense) {
  return isClientCharged(e) && e.reimbursedOn ? 0 : e.amount;
}

/** İade kaydının cari / kasa satırlarındaki kimliği (masrafın kendi satırıyla çakışmasın) */
export const REIMBURSE_SUFFIX = ":iade";

/** Büronun müvekkil adına ödediği (müvekkile yansıyan) masraflar */
export function chargedExpenses(state: ErpState, clientId: string, caseId?: string) {
  return sumBy(
    state.expenses.filter(
      (e) =>
        isClientCharged(e) &&
        recordClientId(state, e) === clientId &&
        (!caseId || e.caseId === caseId),
    ),
    (e) => e.amount,
  );
}

/* ───────────── Cari hesap ───────────── */

export type LedgerEntry = {
  id: string;
  date: ISODate;
  kind:
    | "Masraf"
    | "Masraf iadesi"
    | "Ücret tahakkuku"
    | "Ücret tahsilatı"
    | "İcra tahsilatı"
    | "Müvekkile aktarım"
    | "Kapanan dosyalar";
  description: string;
  caseId?: string;
  /** Müvekkilin borçlandığı tutar */
  debit: number;
  /** Müvekkilin alacaklandığı tutar */
  credit: number;
  balance: number;
};

export function clientLedger(
  state: ErpState,
  clientId: string,
  range?: { from?: ISODate; to?: ISODate },
): { entries: LedgerEntry[]; opening: number; closing: number } {
  const raw: Omit<LedgerEntry, "balance">[] = [];
  const owns = (r: { clientId?: string; caseId?: string }) => recordClientId(state, r) === clientId;

  for (const e of state.expenses.filter((e) => owns(e) && isClientCharged(e))) {
    raw.push({
      id: e.id,
      date: e.date,
      kind: "Masraf",
      description: `${e.type} · ${e.title}`,
      caseId: e.caseId,
      debit: e.amount,
      credit: 0,
    });
    if (e.reimbursedOn)
      raw.push({
        id: e.id + REIMBURSE_SUFFIX,
        date: e.reimbursedOn,
        kind: "Masraf iadesi",
        description: `Müvekkil ödedi · ${e.type} · ${e.title}`,
        caseId: e.caseId,
        debit: 0,
        credit: e.amount,
      });
  }
  for (const p of state.plans.filter((p) => owns(p) && !p.cancelled)) {
    raw.push({
      id: p.id,
      date: p.date,
      kind: "Ücret tahakkuku",
      description: p.title,
      caseId: p.caseId,
      debit: p.total,
      credit: 0,
    });
    for (const inst of p.installments) {
      for (const pay of inst.payments) {
        raw.push({
          id: pay.id,
          date: pay.date,
          kind: "Ücret tahsilatı",
          description: `${p.title} · ${pay.method}`,
          caseId: p.caseId,
          debit: 0,
          credit: pay.amount,
        });
      }
    }
  }
  const closed = state.clients.find((c) => c.id === clientId)?.closedCases;
  if (closed && (closed.receivable || closed.payable)) {
    raw.push({
      id: `closed-${clientId}`,
      date: closed.lastClosedAt.slice(0, 10),
      kind: "Kapanan dosyalar",
      description: closed.caseCount
        ? `Kapanan ${closed.caseCount} dosya ve arşivlenen kayıtların devri`
        : "Arşivlenen eski kayıtların devri",
      debit: closed.receivable,
      credit: closed.payable,
    });
  }
  // Borçlu olduğumuz dosyalar müvekkil carisine girmez
  const enfIds = new Set(
    state.enforcements
      .filter((e) => e.clientId === clientId && e.side !== "Borçlu")
      .map((e) => e.id),
  );
  for (const c of state.collections.filter((c) => enfIds.has(c.enforcementId))) {
    const ef = state.enforcements.find((e) => e.id === c.enforcementId);
    raw.push({
      id: c.id,
      date: c.date,
      kind: "İcra tahsilatı",
      description: `İcra tahsilatı · ${ef?.no ?? ""}`,
      debit: 0,
      credit: c.amount,
    });
  }
  for (const t of state.transactions.filter(
    (t) => t.category === "Müvekkile aktarım" && t.clientId === clientId,
  )) {
    raw.push({
      id: t.id,
      date: t.date,
      kind: "Müvekkile aktarım",
      description: t.description || "Müvekkile ödeme",
      debit: Math.abs(t.amount),
      credit: 0,
    });
  }

  raw.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  let running = 0;
  let opening = 0;
  const entries: LedgerEntry[] = [];
  for (const r of raw) {
    running = round2(running + r.debit - r.credit);
    if (range?.from && r.date < range.from) {
      opening = running;
      continue;
    }
    if (range?.to && r.date > range.to) continue;
    entries.push({ ...r, balance: running });
  }
  const closing = entries.length ? entries[entries.length - 1].balance : opening;
  return { entries, opening, closing };
}

export function clientFinance(state: ErpState, clientId: string) {
  const plans = state.plans.filter((p) => p.clientId === clientId && !p.cancelled);
  const summaries = plans.map(planSummary);
  const feeTotal = sumBy(plans, (p) => p.total);
  const feePaid = sumBy(summaries, (s) => s.paid);
  const feeRemaining = sumBy(summaries, (s) => s.remaining);
  const feeOverdue = sumBy(summaries, (s) => s.overdueAmount);
  const { closing } = clientLedger(state, clientId);
  return {
    expenseCharged: chargedExpenses(state, clientId),
    feeTotal,
    feePaid,
    feeRemaining,
    feeOverdue,
    balance: closing,
    status: (closing > 0.005 ? "Borçlu" : closing < -0.005 ? "Alacaklı" : "Kapalı") as
      "Borçlu" | "Alacaklı" | "Kapalı",
  };
}

/* ───────────── Banka / Kasa ───────────── */

export type AccountEntry = {
  id: string;
  date: ISODate;
  description: string;
  source: "Açılış" | "Masraf" | "Tahsilat" | "İcra" | "Virman" | "Diğer" | "Aktarım";
  amount: number;
  balance: number;
  clientId?: string;
};

export function accountLedger(state: ErpState, accountId: string) {
  const acc = state.accounts.find((a) => a.id === accountId);
  const raw: Omit<AccountEntry, "balance">[] = [];
  if (acc && acc.openingBalance) {
    raw.push({
      id: `${acc.id}-open`,
      date: acc.openingDate,
      description: "Açılış bakiyesi",
      source: "Açılış",
      amount: acc.openingBalance,
    });
  }
  const clientName = (id?: string) => state.clients.find((c) => c.id === id)?.name ?? "";
  for (const e of state.expenses.filter((e) => e.paidBy === "Büro" && e.accountId === accountId)) {
    raw.push({
      id: e.id,
      date: e.date,
      description: `${e.type} · ${e.title}`,
      source: "Masraf",
      amount: -e.amount,
      clientId: recordClientId(state, e),
    });
  }
  for (const e of state.expenses.filter(
    (e) => isClientCharged(e) && e.reimbursedOn && e.reimbursedAccountId === accountId,
  )) {
    raw.push({
      id: e.id + REIMBURSE_SUFFIX,
      date: e.reimbursedOn!,
      description: `Masraf iadesi · ${e.type} · ${e.title}`,
      source: "Masraf",
      amount: e.amount,
      clientId: recordClientId(state, e),
    });
  }
  for (const p of state.plans) {
    for (const inst of p.installments) {
      for (const pay of inst.payments.filter((pay) => pay.accountId === accountId)) {
        raw.push({
          id: pay.id,
          date: pay.date,
          description: `${p.title} · ${clientName(p.clientId)}`,
          source: "Tahsilat",
          amount: pay.amount,
          clientId: p.clientId,
        });
      }
    }
  }
  for (const c of state.collections.filter((c) => c.accountId === accountId)) {
    const ef = state.enforcements.find((e) => e.id === c.enforcementId);
    raw.push({
      id: c.id,
      date: c.date,
      description: `İcra tahsilatı · ${ef?.no ?? ""}`,
      source: "İcra",
      amount: c.amount,
      clientId: ef?.clientId,
    });
  }
  for (const t of state.transactions.filter((t) => t.accountId === accountId)) {
    raw.push({
      id: t.id,
      date: t.date,
      description: t.description,
      source:
        t.category === "Virman"
          ? "Virman"
          : t.category === "Müvekkile aktarım"
            ? "Aktarım"
            : "Diğer",
      amount: t.amount,
      clientId: t.clientId,
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const entries = raw.map((r) => {
    running = round2(running + r.amount);
    return { ...r, balance: running };
  });
  return { entries, balance: running };
}

/** Gelen paranın (tahsilat) varsayılan hesabı: Barokart dışındaki ilk aktif banka, yoksa kasa. */
export function defaultIncomeAccountId(state: ErpState) {
  const active = state.accounts.filter((a) => a.active);
  return (
    active.find((a) => a.type === "Banka" && !/baro\s*kart/i.test(a.name)) ??
    active.find((a) => a.type === "Kasa") ??
    active[0]
  )?.id;
}

export function accountBalances(state: ErpState) {
  return state.accounts.map((a) => ({ account: a, balance: accountLedger(state, a.id).balance }));
}

/* ───────────── Dosya özeti ───────────── */

export function caseFinance(state: ErpState, caseId: string) {
  const expenses = state.expenses.filter((e) => e.caseId === caseId);
  const plans = state.plans.filter((p) => p.caseId === caseId && !p.cancelled);
  const summaries = plans.map(planSummary);
  return {
    expenseTotal: sumBy(expenses, (e) => e.amount),
    chargedTotal: sumBy(expenses.filter(isClientCharged), (e) => e.amount),
    feeTotal: sumBy(plans, (p) => p.total),
    feePaid: sumBy(summaries, (s) => s.paid),
    feeRemaining: sumBy(summaries, (s) => s.remaining),
  };
}

/* ───────────── İcra ───────────── */

export type PromiseStatus = PaymentPromise["status"] | "Gecikmiş";

export function promiseStatus(p: PaymentPromise): PromiseStatus {
  if (p.status === "Bekliyor" && p.dueDate < today()) return "Gecikmiş";
  return p.status;
}

export function enforcementSummary(state: ErpState, enforcementId: string) {
  const ef = state.enforcements.find((e) => e.id === enforcementId);
  const claim = ef ? round2(ef.principal + ef.interest + ef.costs) : 0;
  const cols = state.collections.filter((c) => c.enforcementId === enforcementId);
  const collected = sumBy(cols, (c) => c.amount);
  const promises = state.promises.filter((p) => p.enforcementId === enforcementId);
  const openPromises = promises
    .filter((p) => p.status === "Bekliyor")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    claim,
    collected,
    remaining: Math.max(round2(claim - collected), 0),
    progress: claim > 0 ? Math.min(collected / claim, 1) : 0,
    nextPromise: openPromises[0],
    overduePromises: openPromises.filter((p) => p.dueDate < today()).length,
    untransferred: sumBy(
      cols.filter((c) => !c.transferredToClient),
      (c) => c.amount,
    ),
  };
}

export function debtorSummary(state: ErpState, debtorId: string) {
  // Borçlu olduğumuz dosyalardaki karşı taraf (alacaklı) borçlu sayılmaz
  const files = state.enforcements.filter(
    (e) => e.side !== "Borçlu" && e.debtorIds.includes(debtorId),
  );
  const claim = sumBy(files, (f) => f.principal + f.interest + f.costs);
  const collected = sumBy(
    state.collections.filter((c) => c.debtorId === debtorId),
    (c: Collection) => c.amount,
  );
  const promises = state.promises.filter((p) => p.debtorId === debtorId);
  const kept = promises.filter((p) => p.status === "Tutuldu").length;
  const broken = promises.filter(
    (p) => promiseStatus(p) === "Tutulmadı" || promiseStatus(p) === "Gecikmiş",
  ).length;
  return {
    files,
    claim,
    collected,
    remaining: Math.max(round2(claim - collected), 0),
    promiseCount: promises.length,
    reliability: kept + broken > 0 ? kept / (kept + broken) : null,
  };
}

/* ───────────── Yıllık özet ve arşiv ───────────── */

export function emptyYearStats(): YearStats {
  return {
    feeIncome: 0,
    icraCollected: 0,
    officeExpense: 0,
    clientExpense: 0,
    otherIncome: 0,
    otherExpense: 0,
    closedCases: 0,
  };
}

type StatSources = {
  payments?: Array<{ date: ISODate; amount: number }>;
  collections?: Array<{ date: ISODate; amount: number }>;
  expenses?: Expense[];
  transactions?: AccountTx[];
};

/** Kayıtların tutarlarını yıl bazında `target`a ekler (yeni nesne döndürür). */
export function addYearStats(
  target: Record<string, YearStats>,
  src: StatSources,
): Record<string, YearStats> {
  const out: Record<string, YearStats> = Object.fromEntries(
    Object.entries(target).map(([y, v]) => [y, { ...v }]),
  );
  const at = (date: string) => (out[date.slice(0, 4)] ??= emptyYearStats());
  for (const p of src.payments ?? []) at(p.date).feeIncome += p.amount;
  for (const c of src.collections ?? []) at(c.date).icraCollected += c.amount;
  for (const e of src.expenses ?? []) {
    if (e.chargeTo === "Büro") at(e.date).officeExpense += e.amount;
    else at(e.date).clientExpense += e.amount;
  }
  for (const t of src.transactions ?? []) {
    if (t.category === "Diğer gelir") at(t.date).otherIncome += t.amount;
    if (t.category === "Diğer gider") at(t.date).otherExpense += Math.abs(t.amount);
  }
  for (const v of Object.values(out))
    for (const k of Object.keys(v) as Array<keyof YearStats>) v[k] = round2(v[k]);
  return out;
}

/** Her yılın para toplamları: mevcut kayıtlar + arşivlenmiş (silinmiş) kayıtlar. */
export function yearlySummary(state: ErpState) {
  const live = addYearStats(
    {},
    {
      payments: state.plans.flatMap((p) => p.installments.flatMap((i) => i.payments)),
      collections: state.collections,
      expenses: state.expenses,
      transactions: state.transactions,
    },
  );
  const archived = state.archive.years;
  const years = [...new Set([...Object.keys(live), ...Object.keys(archived)])].sort().reverse();
  return years.map((year) => {
    const a = archived[year] ?? emptyYearStats();
    const l = live[year] ?? emptyYearStats();
    const sum = Object.fromEntries(
      (Object.keys(a) as Array<keyof YearStats>).map((k) => [k, round2(a[k] + l[k])]),
    ) as YearStats;
    return {
      year,
      ...sum,
      net: round2(sum.feeIncome + sum.otherIncome - sum.officeExpense - sum.otherExpense),
      hasArchive: !!archived[year],
    };
  });
}

/** Seçilen yıl ve öncesinde arşivlenince silinecek kayıtlar (ayrıntılar). */
export function archiveCandidates(state: ErpState, throughYear: number) {
  const end = `${throughYear}-12-31`;
  const old = (d?: string) => !!d && d.slice(0, 10) <= end;
  const plans = state.plans.filter((p) => {
    const pays = p.installments.flatMap((i) => i.payments);
    const settled = p.cancelled || planSummary(p).remaining <= 0.005;
    return settled && old(p.date) && pays.every((x) => old(x.date));
  });
  return {
    end,
    expenses: state.expenses.filter((e) => old(e.date)),
    plans,
    collections: state.collections.filter((c) => old(c.date) && c.transferredToClient),
    transactions: state.transactions.filter((t) => old(t.date)),
    reminders: state.reminders.filter((r) => old(r.date) && r.status !== "Bekliyor"),
    promises: state.promises.filter((p) => old(p.dueDate) && p.status !== "Bekliyor"),
    contacts: state.contacts.filter((c) => old(c.date)),
    notifications: state.notifications.filter((n) => old(n.createdAt)),
  };
}

/* ───────────── Büro geneli ───────────── */

export function feeIncomeInRange(state: ErpState, from: ISODate, to: ISODate) {
  return sum(
    state.plans.flatMap((p) =>
      p.installments.flatMap((i) =>
        i.payments.filter((pay) => pay.date >= from && pay.date <= to).map((pay) => pay.amount),
      ),
    ),
  );
}

export function monthlySeries(state: ErpState, months = 12) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const rows = new Map(
    keys.map((k) => [k, { key: k, income: 0, officeExpense: 0, clientExpense: 0 }]),
  );
  for (const p of state.plans)
    for (const i of p.installments)
      for (const pay of i.payments) {
        const r = rows.get(monthKey(pay.date));
        if (r) r.income += pay.amount;
      }
  for (const t of state.transactions) {
    const r = rows.get(monthKey(t.date));
    if (!r) continue;
    if (t.category === "Diğer gelir") r.income += t.amount;
    if (t.category === "Diğer gider") r.officeExpense += Math.abs(t.amount);
  }
  for (const e of state.expenses) {
    const r = rows.get(monthKey(e.date));
    if (!r) continue;
    if (e.chargeTo === "Büro") r.officeExpense += e.amount;
    else r.clientExpense += e.amount;
  }
  return [...rows.values()].map((r) => ({
    ...r,
    income: round2(r.income),
    officeExpense: round2(r.officeExpense),
    clientExpense: round2(r.clientExpense),
    net: round2(r.income - r.officeExpense),
  }));
}

/** Geciken alacak yaşlandırması (vadesi geçmiş açık taksitler). */
export function receivableAging(state: ErpState) {
  const buckets = [
    { label: "0-30 gün", min: 1, max: 30, amount: 0, count: 0 },
    { label: "31-60 gün", min: 31, max: 60, amount: 0, count: 0 },
    { label: "61-90 gün", min: 61, max: 90, amount: 0, count: 0 },
    { label: "90+ gün", min: 91, max: Infinity, amount: 0, count: 0 },
  ];
  for (const row of allInstallments(state)) {
    if (row.status !== "Gecikmiş") continue;
    const late = -daysFromToday(row.inst.dueDate);
    const b = buckets.find((b) => late >= b.min && late <= b.max);
    if (b) {
      b.amount = round2(b.amount + row.remaining);
      b.count++;
    }
  }
  return buckets;
}

/* ───────────── Haciz süresi ───────────── */

/** Haczin düşeceği tarih: son haciz tarihi + ayardaki ay (varsayılan 12) */
export function seizureDueDate(e: Pick<EnforcementFile, "lastSeizureDate">, months: number) {
  return e.lastSeizureDate ? addMonths(e.lastSeizureDate, months) : undefined;
}

/** Hatırlatma penceresine girmiş mi (cron ile aynı kural: düşme tarihi − gün ≤ bugün) */
export function seizureWarning(
  e: EnforcementFile,
  settings: { seizureValidMonths: number; seizureReminderDays: number },
) {
  if (e.side === "Borçlu" || isEnforcementInactive(e.status)) return null;
  const due = seizureDueDate(e, settings.seizureValidMonths);
  if (!due) return null;
  const left = daysFromToday(due);
  if (left > settings.seizureReminderDays) return null;
  return { due, left };
}

/* ───────────── İcra süreleri ───────────── */

export type DeadlineKind =
  | "Kesinleştirme"
  | "Tahliye"
  | "İtiraz / ödeme süresi"
  | "Haciz yenileme"
  | "89/2 haciz ihbarnamesi"
  | "89/3 haciz ihbarnamesi"
  | "Banka haczi kesinleşme"
  | "İşveren borçlu ekleme"
  | "Taksit / ödeme sözü";

export type IcraDeadline = {
  id: string;
  kind: DeadlineKind;
  enforcementId: string;
  /** Süreyi doğuran işlem (tebliğ, 89/1, maaş haczi tebliği) */
  eventId?: string;
  promiseId?: string;
  debtorId?: string;
  /** Sürenin başladığı tarih (tebliğ, haciz…) */
  baseDate: ISODate;
  /** Son gün / yapılması gereken gün */
  dueDate: ISODate;
  /** Hatırlatmanın başladığı gün */
  remindFrom: ISODate;
  /** İşlem yapıldı ya da "tamamlandı" işaretlendi */
  resolved: boolean;
};

/**
 * Avukatın talimatındaki süreler. Kurallar veritabanındaki v_icra_deadlines görünümüyle aynıdır
 * (günlük bildirimleri o üretir); burada ekranda anında görünsün diye aynı hesap yapılır.
 * Yalnızca alacaklı olduğumuz ve kapanmamış dosyalar.
 */
export function icraDeadlines(state: ErpState): IcraDeadline[] {
  const s = state.settings;
  // Borçlu olduğumuz dosyalarda yalnızca tebliğ süresi (itiraz / ödeme) izlenir
  const open = new Map(
    state.enforcements.filter((e) => !isEnforcementInactive(e.status)).map((e) => [e.id, e]),
  );
  const later = (enfId: string, date: ISODate, exceptId: string, type: string) =>
    state.events.some(
      (l) => l.enforcementId === enfId && l.id !== exceptId && l.date >= date && l.type === type,
    );
  const out: IcraDeadline[] = [];
  for (const ev of state.events) {
    const en = open.get(ev.enforcementId);
    if (!en) continue;
    const done = !!ev.data?.doneAt;
    const base = { enforcementId: en.id, eventId: ev.id, debtorId: ev.debtorId, baseDate: ev.date };
    if (ev.type === EVENT_TYPE_SERVICE) {
      const proc = s.procedures.find((p) => p.name === en.procedure);
      if (!proc || proc.days == null) continue;
      if (en.side === "Borçlu") {
        // Son gün = tebliğ + süre; kaçırılmasın diye 2 gün önceden hatırlatılır
        const last = addDays(ev.date, proc.days);
        out.push({
          ...base,
          id: `teb:${ev.id}`,
          kind: "İtiraz / ödeme süresi",
          dueDate: last,
          remindFrom: addDays(last, -2),
          resolved: done,
        });
        continue;
      }
      const kind: DeadlineKind = proc.action === "Tahliye" ? "Tahliye" : "Kesinleştirme";
      const due = addDays(ev.date, proc.days + 1);
      out.push({
        ...base,
        id: `teb:${ev.id}`,
        kind,
        dueDate: due,
        remindFrom: due,
        resolved:
          done ||
          later(en.id, ev.date, ev.id, kind === "Tahliye" ? EVENT_TYPE_EVICTION : EVENT_TYPE_FINALIZED),
      });
    } else if (en.side === "Borçlu") {
      continue;
    } else if (ev.type === EVENT_TYPE_BANK_891) {
      const due = addDays(ev.date, s.bankResponseDays + 1);
      const banks = normalizeBankAnswers(ev.data?.banks);
      out.push({
        ...base,
        id: `b89:${ev.id}`,
        kind: "89/2 haciz ihbarnamesi",
        dueDate: due,
        remindFrom: due,
        resolved:
          done ||
          (banks.length > 0 && banks.every(bankHasAnswer)) ||
          later(en.id, ev.date, ev.id, EVENT_TYPE_BANK_892),
      });
    } else if (ev.type === EVENT_TYPE_BANK_892) {
      const due = addDays(ev.date, s.bankResponseDays + 1);
      const banks = normalizeBankAnswers(ev.data?.banks);
      out.push({
        ...base,
        id: `b892:${ev.id}`,
        kind: "89/3 haciz ihbarnamesi",
        dueDate: due,
        remindFrom: due,
        resolved:
          done ||
          (banks.length > 0 && banks.every(bankHasAnswer)) ||
          later(en.id, ev.date, ev.id, EVENT_TYPE_BANK_893),
      });
    } else if (ev.type === EVENT_TYPE_BANK_893) {
      // Menfi tespit davası yoksa: cevap süresi + 1 = 16. gün (varsayılan 15 gün)
      const due = addDays(ev.date, s.bankResponseDays + 1);
      const banks = normalizeBankAnswers(ev.data?.banks);
      out.push({
        ...base,
        id: `b893:${ev.id}`,
        kind: "Banka haczi kesinleşme",
        dueDate: due,
        remindFrom: due,
        resolved:
          done ||
          (banks.length > 0 && banks.every(bankHasAnswer)) ||
          later(en.id, ev.date, ev.id, EVENT_TYPE_FINALIZED),
      });
    } else if (ev.type === EVENT_TYPE_SALARY) {
      const due = addDays(ev.date, s.salaryResponseDays + 1);
      out.push({
        ...base,
        id: `maas:${ev.id}`,
        kind: "İşveren borçlu ekleme",
        dueDate: due,
        remindFrom: due,
        resolved: done || later(en.id, ev.date, ev.id, EVENT_TYPE_ADD_DEBTOR),
      });
    }
  }
  for (const en of open.values()) {
    if (!en.lastSeizureDate || en.side === "Borçlu") continue;
    const due = addMonths(en.lastSeizureDate, s.seizureValidMonths);
    out.push({
      id: `hz:${en.id}:${due}`,
      kind: "Haciz yenileme",
      enforcementId: en.id,
      baseDate: en.lastSeizureDate,
      dueDate: due,
      remindFrom: addDays(due, -s.seizureReminderDays),
      resolved: false,
    });
  }
  for (const p of state.promises) {
    if (p.status !== "Bekliyor" || open.get(p.enforcementId)?.side !== "Alacaklı") continue;
    out.push({
      id: `prm:${p.id}`,
      kind: "Taksit / ödeme sözü",
      enforcementId: p.enforcementId,
      promiseId: p.id,
      debtorId: p.debtorId,
      baseDate: p.dueDate,
      dueDate: p.dueDate,
      remindFrom: p.dueDate,
      resolved: false,
    });
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Süre başlıkları (bildirim ve uyarılarda) */
export const DEADLINE_TITLES: Record<DeadlineKind, string> = {
  Kesinleştirme: "Kesinleştirme zamanı",
  Tahliye: "Tahliye talebi zamanı",
  "İtiraz / ödeme süresi": "İtiraz / ödeme süresi doluyor",
  "Haciz yenileme": "Haciz yenilenmeli",
  "89/2 haciz ihbarnamesi": "89/2 gönderilmeli: cevap vermeyen banka var",
  "89/3 haciz ihbarnamesi": "89/3 gönderilmeli: cevap vermeyen banka var",
  "Banka haczi kesinleşme": "Menfi tespit yoksa banka haczi kesinleşmeli",
  "İşveren borçlu ekleme": "Maaş haczi: işveren borçlu eklenmeli",
  "Taksit / ödeme sözü": "Taksit / ödeme sözü günü",
};

/* ───────────── Uyarılar ───────────── */

export type Alert = {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  link: string;
  date: ISODate;
  category: "Taksit" | "Ödeme sözü" | "Ajanda" | "Haciz" | "Süre";
};

export function computeAlerts(
  state: ErpState,
  user: User,
  canSeeFinance: boolean,
  canSeeAllAgenda = canSeeFinance,
): Alert[] {
  const t = today();
  const soon = addDays(t, 3);
  const alerts: Alert[] = [];
  const clientName = (id?: string) => state.clients.find((c) => c.id === id)?.name ?? "—";

  if (canSeeFinance) {
    for (const row of allInstallments(state)) {
      if (row.status === "Ödendi") continue;
      if (row.inst.dueDate > soon) continue;
      const late = row.inst.dueDate < t;
      alerts.push({
        id: `inst-${row.inst.id}`,
        tone: late ? "danger" : "warning",
        title: late ? "Geciken taksit" : "Vadesi yaklaşan taksit",
        detail: `${clientName(row.plan.clientId)} · ${formatMoney(row.remaining)}`,
        link: "/tahsilatlar",
        date: row.inst.dueDate,
        category: "Taksit",
      });
    }
  }

  const visibleEnforcements = state.enforcements.filter(
    (e) => canSeeFinance || e.responsibleIds.includes(user.id),
  );
  const myEnforcements = new Set(
    visibleEnforcements.filter((e) => e.side !== "Borçlu").map((e) => e.id),
  );

  for (const e of visibleEnforcements) {
    const w = seizureWarning(e, state.settings);
    if (!w) continue;
    alerts.push({
      id: `hz-${e.id}`,
      tone: w.left <= 0 ? "danger" : "warning",
      title:
        w.left < 0
          ? "Haciz süresi doldu"
          : w.left === 0
            ? "Haciz bugün düşüyor"
            : `Haczin düşmesine ${w.left} gün kaldı`,
      detail: `${e.no} · ${e.office}`,
      link: `/icra/${e.id}`,
      date: w.due,
      category: "Haciz",
    });
  }
  for (const p of state.promises) {
    if (p.status !== "Bekliyor" || !myEnforcements.has(p.enforcementId) || p.dueDate > soon)
      continue;
    const debtor = state.debtors.find((d) => d.id === p.debtorId);
    const late = p.dueDate < t;
    alerts.push({
      id: `prm-${p.id}`,
      tone: late ? "danger" : "warning",
      title: late ? "Ödeme sözü tutulmadı" : "Ödeme sözü yaklaşıyor",
      detail: `${debtor?.name ?? "Borçlu"} · ${formatMoney(p.amount)}`,
      link: `/icra/${p.enforcementId}`,
      date: p.dueDate,
      category: "Ödeme sözü",
    });
  }

  // Takip şekline göre süreler: kesinleştirme, tahliye, 89/2, işveren borçlu ekleme
  // (haciz yenileme yukarıda, taksit / ödeme sözü "Ödeme sözü" uyarılarında)
  const visibleIds = new Set(visibleEnforcements.map((e) => e.id));
  for (const d of icraDeadlines(state)) {
    if (d.resolved || d.kind === "Haciz yenileme" || d.kind === "Taksit / ödeme sözü") continue;
    if (!visibleIds.has(d.enforcementId) || d.remindFrom > t) continue;
    const e = state.enforcements.find((x) => x.id === d.enforcementId);
    alerts.push({
      id: `dl-${d.id}`,
      tone: d.dueDate < t ? "danger" : "warning",
      title: DEADLINE_TITLES[d.kind],
      detail: `${e?.no ?? ""} · ${e?.office ?? ""}`,
      link: `/icra/${d.enforcementId}`,
      date: d.dueDate,
      category: "Süre",
    });
  }

  for (const r of state.reminders) {
    if (r.status !== "Bekliyor") continue;
    if (!canSeeAllAgenda && r.assigneeId !== user.id) continue;
    if (r.date > addDays(t, 1)) continue;
    const late = r.date < t;
    alerts.push({
      id: `rem-${r.id}`,
      tone: late ? "danger" : r.type === "Duruşma" ? "warning" : "info",
      title: late ? `Geçmiş: ${r.type}` : r.date === t ? `Bugün: ${r.type}` : `Yarın: ${r.type}`,
      detail: r.title,
      // İcra dosyasına bağlı kontrol hatırlatması doğrudan dosyayı açar
      link: r.enforcementId ? `/icra/${r.enforcementId}` : "/takvim",
      date: r.date,
      category: "Ajanda",
    });
  }

  const rank = { danger: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone] || a.date.localeCompare(b.date));
}
