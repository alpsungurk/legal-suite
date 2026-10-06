/**
 * State'ten türetilen finans hesapları. Hepsi saf fonksiyondur; hiçbir şey
 * saklanmaz, böylece veriler her zaman tutarlı kalır.
 */
import type {
  CaseFile,
  Collection,
  ErpState,
  Expense,
  FeePlan,
  Installment,
  ISODate,
  PaymentPromise,
  User,
} from "@/lib/erp-types";
import {
  addDays,
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

/* ───────────── Masraf avansı ───────────── */

/** Müvekkile yansıyan ve büronun ödediği masraf: avanstan düşer. */
export function isClientCharged(e: Expense) {
  return e.chargeTo === "Müvekkil" && e.paidBy === "Büro";
}

export function advanceBalance(state: ErpState, clientId: string, caseId?: string) {
  const inScope = (r: { clientId?: string; caseId?: string }) =>
    recordClientId(state, r) === clientId && (!caseId || r.caseId === caseId);
  const received = sumBy(
    state.advances.filter((a) => inScope(a)),
    (a) => (a.kind === "Avans" ? a.amount : -a.amount),
  );
  const spent = sumBy(
    state.expenses.filter((e) => inScope(e) && isClientCharged(e)),
    (e) => e.amount,
  );
  return { received, spent, balance: round2(received - spent) };
}

/* ───────────── Cari hesap ───────────── */

export type LedgerEntry = {
  id: string;
  date: ISODate;
  kind:
    | "Avans"
    | "Avans iadesi"
    | "Masraf"
    | "Ücret tahakkuku"
    | "Ücret tahsilatı"
    | "İcra tahsilatı"
    | "Müvekkile aktarım";
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

  for (const a of state.advances.filter(owns)) {
    raw.push({
      id: a.id,
      date: a.date,
      kind: a.kind === "Avans" ? "Avans" : "Avans iadesi",
      description: a.note || (a.kind === "Avans" ? "Masraf avansı alındı" : "Avans iadesi"),
      caseId: a.caseId,
      debit: a.kind === "İade" ? a.amount : 0,
      credit: a.kind === "Avans" ? a.amount : 0,
    });
  }
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
  const enfIds = new Set(
    state.enforcements.filter((e) => e.clientId === clientId).map((e) => e.id),
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
  const adv = advanceBalance(state, clientId);
  const plans = state.plans.filter((p) => p.clientId === clientId && !p.cancelled);
  const summaries = plans.map(planSummary);
  const feeTotal = sumBy(plans, (p) => p.total);
  const feePaid = sumBy(summaries, (s) => s.paid);
  const feeRemaining = sumBy(summaries, (s) => s.remaining);
  const feeOverdue = sumBy(summaries, (s) => s.overdueAmount);
  const { closing } = clientLedger(state, clientId);
  const client = state.clients.find((c) => c.id === clientId);
  const lowAdvance =
    !!client && adv.balance < (client.advanceThreshold ?? 0) && (adv.received > 0 || adv.spent > 0);
  return {
    advance: adv,
    feeTotal,
    feePaid,
    feeRemaining,
    feeOverdue,
    balance: closing,
    lowAdvance,
    status: (closing > 0.005 ? "Borçlu" : closing < -0.005 ? "Alacaklı" : "Kapalı") as
      "Borçlu" | "Alacaklı" | "Kapalı",
  };
}

/* ───────────── Banka / Kasa ───────────── */

export type AccountEntry = {
  id: string;
  date: ISODate;
  description: string;
  source: "Açılış" | "Avans" | "Masraf" | "Tahsilat" | "İcra" | "Virman" | "Diğer" | "Aktarım";
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
  for (const a of state.advances.filter((a) => a.accountId === accountId)) {
    raw.push({
      id: a.id,
      date: a.date,
      description: `${a.kind === "Avans" ? "Masraf avansı" : "Avans iadesi"} · ${clientName(a.clientId)}`,
      source: "Avans",
      amount: a.kind === "Avans" ? a.amount : -a.amount,
      clientId: a.clientId,
    });
  }
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

export function accountBalances(state: ErpState) {
  return state.accounts.map((a) => ({ account: a, balance: accountLedger(state, a.id).balance }));
}

/* ───────────── Dosya özeti ───────────── */

export function caseFinance(state: ErpState, caseId: string) {
  const expenses = state.expenses.filter((e) => e.caseId === caseId);
  const advances = state.advances.filter((a) => a.caseId === caseId);
  const plans = state.plans.filter((p) => p.caseId === caseId && !p.cancelled);
  const summaries = plans.map(planSummary);
  return {
    expenseTotal: sumBy(expenses, (e) => e.amount),
    chargedTotal: sumBy(expenses.filter(isClientCharged), (e) => e.amount),
    advanceTotal: sumBy(advances, (a) => (a.kind === "Avans" ? a.amount : -a.amount)),
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
  const files = state.enforcements.filter((e) => e.debtorIds.includes(debtorId));
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
    keys.map((k) => [k, { key: k, income: 0, officeExpense: 0, clientExpense: 0, advances: 0 }]),
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
  for (const a of state.advances) {
    const r = rows.get(monthKey(a.date));
    if (r) r.advances += a.kind === "Avans" ? a.amount : -a.amount;
  }
  return [...rows.values()].map((r) => ({
    ...r,
    income: round2(r.income),
    officeExpense: round2(r.officeExpense),
    clientExpense: round2(r.clientExpense),
    advances: round2(r.advances),
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

/* ───────────── Uyarılar ───────────── */

export type Alert = {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  detail: string;
  link: string;
  date: ISODate;
  category: "Taksit" | "Ödeme sözü" | "Ajanda" | "Avans" | "Belge" | "Mesaj";
};

export function computeAlerts(state: ErpState, user: User, canSeeFinance: boolean): Alert[] {
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
        link: "/taksitler",
        date: row.inst.dueDate,
        category: "Taksit",
      });
    }
    for (const c of state.clients) {
      const fin = clientFinance(state, c.id);
      if (fin.lowAdvance) {
        alerts.push({
          id: `adv-${c.id}`,
          tone: fin.advance.balance < 0 ? "danger" : "warning",
          title: fin.advance.balance < 0 ? "Avans eksiye düştü" : "Avans azaldı",
          detail: `${c.name} · bakiye ${formatMoney(fin.advance.balance)}`,
          link: `/muvekkiller/${c.id}`,
          date: t,
          category: "Avans",
        });
      }
    }
  }

  const myEnforcements = new Set(
    state.enforcements
      .filter((e) => canSeeFinance || e.responsibleIds.includes(user.id))
      .map((e) => e.id),
  );
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

  for (const r of state.reminders) {
    if (r.status !== "Bekliyor") continue;
    if (!canSeeFinance && r.assigneeId !== user.id) continue;
    if (r.date > addDays(t, 1)) continue;
    const late = r.date < t;
    alerts.push({
      id: `rem-${r.id}`,
      tone: late ? "danger" : r.type === "Duruşma" ? "warning" : "info",
      title: late ? `Geçmiş: ${r.type}` : r.date === t ? `Bugün: ${r.type}` : `Yarın: ${r.type}`,
      detail: r.title,
      link: "/takvim",
      date: r.date,
      category: "Ajanda",
    });
  }

  for (const req of state.docRequests.filter((r) => r.status === "Yüklendi")) {
    alerts.push({
      id: `req-${req.id}`,
      tone: "success",
      title: "Müvekkil belge yükledi",
      detail: `${clientName(req.clientId)} · ${req.title}`,
      link: "/belgeler",
      date: req.updatedAt.slice(0, 10),
      category: "Belge",
    });
  }

  const unreadByClient = new Map<string, number>();
  for (const m of state.messages) {
    if (m.readByFirm) continue;
    unreadByClient.set(m.clientId, (unreadByClient.get(m.clientId) ?? 0) + 1);
  }
  for (const [clientId, count] of unreadByClient) {
    alerts.push({
      id: `msg-${clientId}`,
      tone: "info",
      title: "Okunmamış mesaj",
      detail: `${clientName(clientId)} · ${count} mesaj`,
      link: `/mesajlar?musteri=${clientId}`,
      date: t,
      category: "Mesaj",
    });
  }

  const rank = { danger: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone] || a.date.localeCompare(b.date));
}
