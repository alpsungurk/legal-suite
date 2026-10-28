/**
 * UI (camelCase) ↔ Postgres (snake_case) dönüşümleri.
 */
import { defaultSettings } from "@/lib/erp-data";
import { normalizeBankAnswers } from "@/lib/erp-types";
import type {
  Account,
  AccountTx,
  AppNotification,
  AttachmentRef,
  Bank,
  SalaryGarnishment,
  SalaryGarnishmentEntry,
  CaseFile,
  Client,
  Collection,
  ContactLog,
  Debtor,
  DocumentFile,
  EnforcementFile,
  Expense,
  FeePlan,
  FirmProfile,
  Installment,
  InstallmentPayment,
  PaymentPromise,
  Reminder,
  Settings,
  User,
  UserRole,
  YearStats,
  CompanyList,
  EnforcementEvent,
  EventData,
  Procedure,
  EnforcementSide,
} from "@/lib/erp-types";

export function roleToDb(role: UserRole): "admin" | "avukat" {
  return role === "Admin" ? "admin" : "avukat";
}

export function roleFromDb(role: string): UserRole {
  return role === "admin" ? "Admin" : "Avukat";
}

export function newId() {
  return crypto.randomUUID();
}

function iso(v: string | null | undefined): string {
  return v ?? "";
}

function dateOnly(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function timeOnly(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  return v.length >= 5 ? v.slice(0, 5) : v;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function optNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function optStr(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}

/* ───── Attachment ───── */

export function attachmentFromRow(r: Record<string, unknown>): AttachmentRef {
  return {
    id: String(r.id),
    name: String(r.name ?? "dosya"),
    mime: String(r.mime ?? "application/octet-stream"),
    size: num(r.size),
  };
}

/* ───── Profile / User ───── */

export function userFromProfile(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    role: roleFromDb(String(r.role ?? "avukat")),
    email: String(r.email ?? ""),
    username: String(r.username ?? ""),
    phone: optStr(r.phone),
    title: optStr(r.title),
    active: r.active !== false,
    passwordHash: "",
    passwordSalt: "",
    permissions: (r.permissions as Record<string, boolean>) ?? {},
  };
}

export function profileToRow(u: Partial<User> & { id?: string }) {
  const row: Record<string, unknown> = {};
  if (u.name != null) row.name = u.name;
  if (u.username != null) row.username = u.username.trim().toLocaleLowerCase("tr");
  if (u.email != null) row.email = u.email;
  if (u.phone !== undefined) row.phone = u.phone || null;
  if (u.title !== undefined) row.title = u.title || null;
  if (u.role != null) row.role = roleToDb(u.role);
  if (u.active != null) row.active = u.active;
  if (u.permissions != null) row.permissions = u.permissions;
  return row;
}

/* ───── Settings ───── */

export function settingsFromRow(r: Record<string, unknown> | null): Settings {
  const base = defaultSettings();
  if (!r) return base;
  const firm = (r.firm as Partial<FirmProfile>) ?? {};
  return {
    firm: {
      ...base.firm,
      ...firm,
      name: firm.name || base.firm.name,
      legalName: firm.legalName || firm.name || base.firm.legalName,
    },
    caseTypes: (r.case_types as string[]) ?? base.caseTypes,
    caseStatuses: (r.case_statuses as string[]) ?? base.caseStatuses,
    expenseTypes: (r.expense_types as string[]) ?? base.expenseTypes,
    reminderTypes: (r.reminder_types as string[]) ?? base.reminderTypes,
    documentCategories: (r.document_categories as string[]) ?? base.documentCategories,
    feeKinds: (r.fee_kinds as string[]) ?? base.feeKinds,
    paymentMethods: (r.payment_methods as string[]) ?? base.paymentMethods,
    enforcementStatuses: (r.enforcement_statuses as string[]) ?? base.enforcementStatuses,
    enforcementTypes: (r.enforcement_types as string[]) ?? base.enforcementTypes,
    contactChannels: (r.contact_channels as string[]) ?? base.contactChannels,
    courts: (r.courts as string[]) ?? [],
    enforcementOffices: (r.enforcement_offices as string[]) ?? [],
    rolePermissions: (r.role_permissions as Record<string, boolean>) ?? base.rolePermissions,
    // Aşağıdakiler 20261016 migration'ı ile geldi; çalıştırılmadıysa varsayılanlar kullanılır
    enforcementStopReasons: (r.enforcement_stop_reasons as string[]) ?? base.enforcementStopReasons,
    enforcementEventTypes: (r.enforcement_event_types as string[]) ?? base.enforcementEventTypes,
    inquiryTypes: (r.inquiry_types as string[]) ?? base.inquiryTypes,
    seizureTypes: (r.seizure_types as string[]) ?? base.seizureTypes,
    resultTypes: (r.result_types as string[]) ?? base.resultTypes,
    seizureValidMonths: num(r.seizure_valid_months, base.seizureValidMonths),
    seizureReminderDays: num(r.seizure_reminder_days, base.seizureReminderDays),
    companyLists: companyListsFromJson(r.company_lists),
    closedCaseRetentionMonths: num(r.closed_case_retention_months, base.closedCaseRetentionMonths),
    enforcementCloseReasons:
      (r.enforcement_close_reasons as string[]) ?? base.enforcementCloseReasons,
    claimTypes: (r.claim_types as string[]) ?? base.claimTypes,
    bankAnswerTypes: (r.bank_answer_types as string[]) ?? base.bankAnswerTypes,
    hearingAttendance: (r.hearing_attendance as string[]) ?? base.hearingAttendance,
    caseFeeStatuses: (r.case_fee_statuses as string[]) ?? base.caseFeeStatuses,
    procedures: proceduresFromJson(r.procedures) ?? base.procedures,
    bankResponseDays: num(r.bank_response_days, base.bankResponseDays),
    salaryResponseDays: num(r.salary_response_days, base.salaryResponseDays),
  };
}

function proceduresFromJson(v: unknown): Procedure[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      name: String(x.name ?? ""),
      days: x.days == null || x.days === "" ? null : Number(x.days),
      action: x.action ? String(x.action) : null,
    }))
    .filter((x) => x.name);
}

function companyListsFromJson(v: unknown): CompanyList[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      id: String(x.id ?? ""),
      name: String(x.name ?? ""),
      clientIds: Array.isArray(x.clientIds) ? x.clientIds.map(String) : [],
      icon: typeof x.icon === "string" && x.icon ? x.icon : undefined,
    }))
    .filter((x) => x.id && x.name);
}

export function settingsToRow(s: Partial<Settings>) {
  const row: Record<string, unknown> = {};
  if (s.firm != null) row.firm = s.firm;
  if (s.caseTypes != null) row.case_types = s.caseTypes;
  if (s.caseStatuses != null) row.case_statuses = s.caseStatuses;
  if (s.expenseTypes != null) row.expense_types = s.expenseTypes;
  if (s.reminderTypes != null) row.reminder_types = s.reminderTypes;
  if (s.documentCategories != null) row.document_categories = s.documentCategories;
  if (s.feeKinds != null) row.fee_kinds = s.feeKinds;
  if (s.paymentMethods != null) row.payment_methods = s.paymentMethods;
  if (s.enforcementStatuses != null) row.enforcement_statuses = s.enforcementStatuses;
  if (s.enforcementTypes != null) row.enforcement_types = s.enforcementTypes;
  if (s.contactChannels != null) row.contact_channels = s.contactChannels;
  if (s.courts != null) row.courts = s.courts;
  if (s.enforcementOffices != null) row.enforcement_offices = s.enforcementOffices;
  if (s.rolePermissions != null) row.role_permissions = s.rolePermissions;
  if (s.enforcementStopReasons != null) row.enforcement_stop_reasons = s.enforcementStopReasons;
  if (s.enforcementEventTypes != null) row.enforcement_event_types = s.enforcementEventTypes;
  if (s.inquiryTypes != null) row.inquiry_types = s.inquiryTypes;
  if (s.seizureTypes != null) row.seizure_types = s.seizureTypes;
  if (s.resultTypes != null) row.result_types = s.resultTypes;
  if (s.seizureValidMonths != null) row.seizure_valid_months = s.seizureValidMonths;
  if (s.seizureReminderDays != null) row.seizure_reminder_days = s.seizureReminderDays;
  if (s.companyLists != null) row.company_lists = s.companyLists;
  if (s.closedCaseRetentionMonths != null)
    row.closed_case_retention_months = s.closedCaseRetentionMonths;
  if (s.enforcementCloseReasons != null) row.enforcement_close_reasons = s.enforcementCloseReasons;
  if (s.claimTypes != null) row.claim_types = s.claimTypes;
  if (s.bankAnswerTypes != null) row.bank_answer_types = s.bankAnswerTypes;
  if (s.hearingAttendance != null) row.hearing_attendance = s.hearingAttendance;
  if (s.caseFeeStatuses != null) row.case_fee_statuses = s.caseFeeStatuses;
  if (s.procedures != null) row.procedures = s.procedures;
  if (s.bankResponseDays != null) row.bank_response_days = s.bankResponseDays;
  if (s.salaryResponseDays != null) row.salary_response_days = s.salaryResponseDays;
  return row;
}

/* ───── Clients ───── */

export function clientFromRow(r: Record<string, unknown>): Client {
  const closedCount = num(r.closed_case_count);
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    kind: (r.kind as Client["kind"]) || "Bireysel",
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    status: (r.status as Client["status"]) || "Aktif",
    identity: optStr(r.identity),
    taxOffice: optStr(r.tax_office),
    address: optStr(r.address),
    notes: optStr(r.notes),
    monthlyFee: optNum(r.monthly_fee),
    monthlyFeeStartDate: optStr(r.monthly_fee_start_date)
      ? dateOnly(r.monthly_fee_start_date as string)
      : undefined,
    closedCases:
      closedCount > 0
        ? {
            caseCount: closedCount,
            receivable: num(r.closed_receivable),
            payable: num(r.closed_payable),
            feeTotal: num(r.closed_fee_total),
            feePaid: num(r.closed_fee_paid),
            lastClosedAt: iso(r.closed_last_at as string) || new Date().toISOString(),
          }
        : undefined,
  };
}

export function clientToRow(c: Partial<Client>) {
  const row: Record<string, unknown> = {};
  if (c.name != null) row.name = c.name;
  if (c.kind != null) row.kind = c.kind;
  if (c.email != null) row.email = c.email;
  if (c.phone != null) row.phone = c.phone;
  if (c.status != null) row.status = c.status;
  if (c.identity !== undefined) row.identity = c.identity || null;
  if (c.taxOffice !== undefined) row.tax_office = c.taxOffice || null;
  if (c.address !== undefined) row.address = c.address || null;
  if (c.notes !== undefined) row.notes = c.notes || null;
  if (c.monthlyFee !== undefined) row.monthly_fee = c.monthlyFee ?? null;
  if (c.monthlyFeeStartDate !== undefined)
    row.monthly_fee_start_date = c.monthlyFeeStartDate || null;
  if (c.closedCases) {
    row.closed_case_count = c.closedCases.caseCount;
    row.closed_receivable = c.closedCases.receivable;
    row.closed_payable = c.closedCases.payable;
    row.closed_fee_total = c.closedCases.feeTotal;
    row.closed_fee_paid = c.closedCases.feePaid;
    row.closed_last_at = c.closedCases.lastClosedAt;
  }
  return row;
}

/* ───── Cases ───── */

export function caseFromRow(r: Record<string, unknown>): CaseFile {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    no: String(r.no ?? ""),
    title: String(r.title ?? ""),
    clientId: optStr(r.client_id),
    court: optStr(r.court),
    esasNo: optStr(r.esas_no),
    type: String(r.type ?? "Dava"),
    status: String(r.status ?? "Açık"),
    responsibleIds: (r.responsible_ids as string[]) ?? [],
    opposingParty: optStr(r.opposing_party),
    openingDate: dateOnly(r.opening_date as string),
    closingDate: optStr(r.closing_date) ? dateOnly(r.closing_date as string) : undefined,
    agreedFee: optNum(r.agreed_fee),
    feeStatus: optStr(r.fee_status),
    note: optStr(r.note),
  };
}

export function caseToRow(c: Partial<CaseFile>) {
  const row: Record<string, unknown> = {};
  if (c.no != null) row.no = c.no;
  if (c.title != null) row.title = c.title;
  if (c.clientId !== undefined) row.client_id = c.clientId || null;
  if (c.court !== undefined) row.court = c.court || null;
  if (c.esasNo !== undefined) row.esas_no = c.esasNo || null;
  if (c.type != null) row.type = c.type;
  if (c.status != null) row.status = c.status;
  if (c.responsibleIds != null) row.responsible_ids = c.responsibleIds;
  if (c.opposingParty !== undefined) row.opposing_party = c.opposingParty || null;
  if (c.openingDate != null) row.opening_date = c.openingDate;
  if (c.closingDate !== undefined) row.closing_date = c.closingDate || null;
  if (c.agreedFee !== undefined) row.agreed_fee = c.agreedFee ?? null;
  if (c.feeStatus !== undefined) row.fee_status = c.feeStatus || null;
  if (c.note !== undefined) row.note = c.note || null;
  return row;
}

/* ───── Accounts ───── */

export function accountFromRow(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    type: (r.type as Account["type"]) || "Kasa",
    bankName: optStr(r.bank_name),
    iban: optStr(r.iban),
    openingBalance: num(r.opening_balance),
    openingDate: dateOnly(r.opening_date as string),
    active: r.active !== false,
  };
}

export function accountToRow(a: Partial<Account>) {
  const row: Record<string, unknown> = {};
  if (a.name != null) row.name = a.name;
  if (a.type != null) row.type = a.type;
  if (a.bankName !== undefined) row.bank_name = a.bankName || null;
  if (a.iban !== undefined) row.iban = a.iban || null;
  if (a.openingBalance != null) row.opening_balance = a.openingBalance;
  if (a.openingDate != null) row.opening_date = a.openingDate;
  if (a.active != null) row.active = a.active;
  return row;
}

/* ───── Banks (haciz listesi) ───── */

export function bankFromRow(r: Record<string, unknown>): Bank {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    active: r.active !== false,
  };
}

export function bankToRow(b: Partial<Bank>) {
  const row: Record<string, unknown> = {};
  if (b.name != null) row.name = b.name.trim();
  if (b.active != null) row.active = b.active;
  return row;
}

/* ───── Maaş haczi sıraları ───── */

export function salaryEntryFromRow(r: Record<string, unknown>): SalaryGarnishmentEntry {
  return {
    id: String(r.id),
    office: String(r.office ?? ""),
    fileNo: String(r.file_no ?? ""),
    notifiedAt: optStr(dateOnly(r.notified_at as string)),
    note: optStr(r.note),
    position: num(r.position) || 1,
  };
}

export function salaryGarnishmentFromRow(
  r: Record<string, unknown>,
  entries: SalaryGarnishmentEntry[] = [],
): SalaryGarnishment {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    clientId: String(r.client_id),
    employeeName: String(r.employee_name ?? ""),
    payday: r.payday == null ? undefined : num(r.payday),
    status: r.status === "İşten ayrıldı" ? "İşten ayrıldı" : "Devam ediyor",
    responsibleIds: Array.isArray(r.responsible_ids) ? (r.responsible_ids as string[]) : [],
    leftAt: optStr(dateOnly(r.left_at as string)),
    note: optStr(r.note),
    entries: [...entries].sort((a, b) => a.position - b.position),
  };
}

export function salaryGarnishmentToRow(q: Partial<SalaryGarnishment>) {
  const row: Record<string, unknown> = {};
  if (q.clientId != null) row.client_id = q.clientId;
  if (q.employeeName != null) row.employee_name = q.employeeName.trim();
  if (q.payday !== undefined) row.payday = q.payday ?? null;
  if (q.status != null) row.status = q.status;
  if (q.responsibleIds != null) row.responsible_ids = q.responsibleIds;
  if (q.leftAt !== undefined) row.left_at = q.leftAt || null;
  if (q.note !== undefined) row.note = q.note || null;
  return row;
}

/* ───── Transactions ───── */

export function txFromRow(r: Record<string, unknown>): AccountTx {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    accountId: String(r.account_id),
    date: dateOnly(r.date as string),
    amount: num(r.amount),
    category: r.category as AccountTx["category"],
    description: String(r.description ?? ""),
    transferId: optStr(r.transfer_id),
    clientId: optStr(r.client_id),
  };
}

export function txToRow(t: Partial<AccountTx>) {
  const row: Record<string, unknown> = {};
  if (t.accountId != null) row.account_id = t.accountId;
  if (t.date != null) row.date = t.date;
  if (t.amount != null) row.amount = t.amount;
  if (t.category != null) row.category = t.category;
  if (t.description != null) row.description = t.description;
  if (t.transferId !== undefined) row.transfer_id = t.transferId || null;
  if (t.clientId !== undefined) row.client_id = t.clientId || null;
  return row;
}

/* ───── Debtors ───── */

export function debtorFromRow(r: Record<string, unknown>): Debtor {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    kind: (r.kind as Debtor["kind"]) || "Bireysel",
    identity: optStr(r.identity),
    phone: optStr(r.phone),
    email: optStr(r.email),
    address: optStr(r.address),
    assets: optStr(r.assets),
    notes: optStr(r.notes),
  };
}

export function debtorToRow(d: Partial<Debtor>) {
  const row: Record<string, unknown> = {};
  if (d.name != null) row.name = d.name;
  if (d.kind != null) row.kind = d.kind;
  if (d.identity !== undefined) row.identity = d.identity || null;
  if (d.phone !== undefined) row.phone = d.phone || null;
  if (d.email !== undefined) row.email = d.email || null;
  if (d.address !== undefined) row.address = d.address || null;
  if (d.assets !== undefined) row.assets = d.assets || null;
  if (d.notes !== undefined) row.notes = d.notes || null;
  return row;
}

/* ───── Enforcements ───── */

export function enforcementFromRow(
  r: Record<string, unknown>,
  debtorIds: string[] = [],
): EnforcementFile {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    no: String(r.no ?? ""),
    office: String(r.office ?? ""),
    type: String(r.type ?? "İlamsız"),
    side: (r.side === "Borçlu" ? "Borçlu" : "Alacaklı") as EnforcementSide,
    clientId: String(r.client_id),
    debtorIds,
    principal: num(r.principal),
    interest: num(r.interest),
    costs: num(r.costs),
    status: String(r.status ?? "Açık"),
    stopReason: optStr(r.stop_reason),
    closeReason: optStr(r.close_reason),
    procedure: optStr(r.procedure),
    openingDate: dateOnly(r.opening_date as string),
    responsibleIds: (r.responsible_ids as string[]) ?? [],
    caseId: optStr(r.case_id),
    details: optStr(r.details),
    lastSeizureDate: optStr(dateOnly(r.last_seizure_date as string)),
    note: optStr(r.note),
  };
}

export function enforcementToRow(e: Partial<EnforcementFile>) {
  const row: Record<string, unknown> = {};
  if (e.no != null) row.no = e.no;
  if (e.office != null) row.office = e.office;
  if (e.type != null) row.type = e.type;
  if (e.clientId != null) row.client_id = e.clientId;
  if (e.principal != null) row.principal = e.principal;
  if (e.interest != null) row.interest = e.interest;
  if (e.costs != null) row.costs = e.costs;
  if (e.status != null) row.status = e.status;
  if (e.openingDate != null) row.opening_date = e.openingDate;
  if (e.responsibleIds != null) row.responsible_ids = e.responsibleIds;
  if (e.caseId !== undefined) row.case_id = e.caseId || null;
  if (e.note !== undefined) row.note = e.note || null;
  if (e.side != null) row.side = e.side;
  if (e.stopReason !== undefined) row.stop_reason = e.stopReason || null;
  if (e.closeReason !== undefined) row.close_reason = e.closeReason || null;
  if (e.procedure !== undefined) row.procedure = e.procedure || null;
  if (e.details !== undefined) row.details = e.details || null;
  if (e.lastSeizureDate !== undefined) row.last_seizure_date = e.lastSeizureDate || null;
  return row;
}

/* ───── İcra işlem geçmişi ───── */

export function eventFromRow(r: Record<string, unknown>): EnforcementEvent {
  const raw = r.data && typeof r.data === "object" ? (r.data as EventData) : undefined;
  const data: EventData | undefined = raw
    ? {
        ...raw,
        banks: raw.banks != null ? normalizeBankAnswers(raw.banks) : undefined,
      }
    : undefined;
  if (data && data.banks && data.banks.length === 0) delete data.banks;
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    enforcementId: String(r.enforcement_id),
    debtorId: optStr(r.debtor_id),
    date: dateOnly(r.date as string),
    type: String(r.type ?? ""),
    inquiryType: optStr(r.inquiry_type),
    seizureType: optStr(r.seizure_type),
    result: optStr(r.result),
    amount: optNum(r.amount),
    note: optStr(r.note),
    data,
  };
}

export function eventToRow(e: Partial<EnforcementEvent>) {
  const row: Record<string, unknown> = {};
  if (e.enforcementId != null) row.enforcement_id = e.enforcementId;
  if (e.debtorId !== undefined) row.debtor_id = e.debtorId || null;
  if (e.date != null) row.date = e.date;
  if (e.type != null) row.type = e.type;
  if (e.inquiryType !== undefined) row.inquiry_type = e.inquiryType || null;
  if (e.seizureType !== undefined) row.seizure_type = e.seizureType || null;
  if (e.result !== undefined) row.result = e.result || null;
  if (e.amount !== undefined) row.amount = e.amount ?? null;
  if (e.note !== undefined) row.note = e.note || null;
  if (e.data !== undefined) row.data = e.data && Object.keys(e.data).length ? e.data : null;
  return row;
}

/* ───── Promises / Collections / Contacts ───── */

export function promiseFromRow(r: Record<string, unknown>): PaymentPromise {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    enforcementId: String(r.enforcement_id),
    debtorId: String(r.debtor_id),
    amount: num(r.amount),
    dueDate: dateOnly(r.due_date as string),
    status: r.status as PaymentPromise["status"],
    planId: optStr(r.plan_id),
    installmentNo: optNum(r.installment_no),
    note: optStr(r.note),
  };
}

export function promiseToRow(p: Partial<PaymentPromise>) {
  const row: Record<string, unknown> = {};
  if (p.enforcementId != null) row.enforcement_id = p.enforcementId;
  if (p.debtorId != null) row.debtor_id = p.debtorId;
  if (p.amount != null) row.amount = p.amount;
  if (p.dueDate != null) row.due_date = p.dueDate;
  if (p.status != null) row.status = p.status;
  if (p.planId !== undefined) row.plan_id = p.planId || null;
  if (p.installmentNo !== undefined) row.installment_no = p.installmentNo ?? null;
  if (p.note !== undefined) row.note = p.note || null;
  return row;
}

export function collectionFromRow(r: Record<string, unknown>): Collection {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    enforcementId: String(r.enforcement_id),
    debtorId: String(r.debtor_id),
    amount: num(r.amount),
    date: dateOnly(r.date as string),
    method: String(r.method ?? "Havale/EFT"),
    accountId: optStr(r.account_id),
    promiseId: optStr(r.promise_id),
    transferredToClient: Boolean(r.transferred_to_client),
    note: optStr(r.note),
  };
}

export function collectionToRow(c: Partial<Collection>) {
  const row: Record<string, unknown> = {};
  if (c.enforcementId != null) row.enforcement_id = c.enforcementId;
  if (c.debtorId != null) row.debtor_id = c.debtorId;
  if (c.amount != null) row.amount = c.amount;
  if (c.date != null) row.date = c.date;
  if (c.method != null) row.method = c.method;
  if (c.accountId !== undefined) row.account_id = c.accountId || null;
  if (c.promiseId !== undefined) row.promise_id = c.promiseId || null;
  if (c.transferredToClient != null) row.transferred_to_client = c.transferredToClient;
  if (c.note !== undefined) row.note = c.note || null;
  return row;
}

export function contactFromRow(r: Record<string, unknown>): ContactLog {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    debtorId: String(r.debtor_id),
    enforcementId: optStr(r.enforcement_id),
    date: dateOnly(r.date as string),
    channel: String(r.channel ?? ""),
    note: String(r.note ?? ""),
    userId: String(r.user_id ?? r.created_by ?? ""),
  };
}

export function contactToRow(c: Partial<ContactLog>) {
  const row: Record<string, unknown> = {};
  if (c.debtorId != null) row.debtor_id = c.debtorId;
  if (c.enforcementId !== undefined) row.enforcement_id = c.enforcementId || null;
  if (c.date != null) row.date = c.date;
  if (c.channel != null) row.channel = c.channel;
  if (c.note != null) row.note = c.note;
  if (c.userId != null) row.user_id = c.userId;
  return row;
}

/* ───── Expenses ───── */

export function expenseFromRow(
  r: Record<string, unknown>,
  receipts: AttachmentRef[] = [],
): Expense {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    title: String(r.title ?? ""),
    type: String(r.type ?? ""),
    amount: num(r.amount),
    date: dateOnly(r.date as string),
    caseId: optStr(r.case_id),
    enforcementId: optStr(r.enforcement_id),
    clientId: optStr(r.client_id),
    chargeTo: (r.charge_to as Expense["chargeTo"]) || "Müvekkil",
    paidBy: (r.paid_by as Expense["paidBy"]) || "Büro",
    accountId: optStr(r.account_id),
    reimbursedOn: r.reimbursed_on ? dateOnly(r.reimbursed_on as string) : undefined,
    reimbursedAccountId: optStr(r.reimbursed_account_id),
    receipts,
    note: optStr(r.note),
    createdBy: String(r.created_by ?? ""),
  };
}

export function expenseToRow(e: Partial<Expense>) {
  const row: Record<string, unknown> = {};
  if (e.title != null) row.title = e.title;
  if (e.type != null) row.type = e.type;
  if (e.amount != null) row.amount = e.amount;
  if (e.date != null) row.date = e.date;
  if (e.caseId !== undefined) row.case_id = e.caseId || null;
  if (e.enforcementId !== undefined) row.enforcement_id = e.enforcementId || null;
  if (e.clientId !== undefined) row.client_id = e.clientId || null;
  if (e.chargeTo != null) row.charge_to = e.chargeTo;
  if (e.paidBy != null) row.paid_by = e.paidBy;
  if (e.accountId !== undefined) row.account_id = e.accountId || null;
  if (e.reimbursedOn !== undefined) row.reimbursed_on = e.reimbursedOn || null;
  if (e.reimbursedAccountId !== undefined)
    row.reimbursed_account_id = e.reimbursedAccountId || null;
  if (e.note !== undefined) row.note = e.note || null;
  return row;
}

/* ───── Fee plans ───── */

export function paymentFromRow(r: Record<string, unknown>): InstallmentPayment {
  return {
    id: String(r.id),
    date: dateOnly(r.date as string),
    amount: num(r.amount),
    method: String(r.method ?? ""),
    accountId: optStr(r.account_id),
    note: optStr(r.note),
  };
}

export function installmentFromRow(
  r: Record<string, unknown>,
  payments: InstallmentPayment[] = [],
): Installment {
  return {
    id: String(r.id),
    dueDate: dateOnly(r.due_date as string),
    amount: num(r.amount),
    payments,
  };
}

export function planFromRow(r: Record<string, unknown>, installments: Installment[] = []): FeePlan {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    title: String(r.title ?? ""),
    kind: String(r.kind ?? "Vekalet ücreti"),
    clientId: String(r.client_id),
    caseId: optStr(r.case_id),
    date: dateOnly(r.date as string),
    total: num(r.total),
    period: optStr(r.period),
    cancelled: Boolean(r.cancelled),
    note: optStr(r.note),
    installments,
  };
}

export function planToRow(p: Partial<FeePlan>) {
  const row: Record<string, unknown> = {};
  if (p.title != null) row.title = p.title;
  if (p.kind != null) row.kind = p.kind;
  if (p.clientId != null) row.client_id = p.clientId;
  if (p.caseId !== undefined) row.case_id = p.caseId || null;
  if (p.date != null) row.date = p.date;
  if (p.total != null) row.total = p.total;
  if (p.period !== undefined) row.period = p.period || null;
  if (p.cancelled != null) row.cancelled = p.cancelled;
  if (p.note !== undefined) row.note = p.note || null;
  return row;
}

/* ───── Reminders / Documents / Notifications / Activities ───── */

export function reminderFromRow(r: Record<string, unknown>): Reminder {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    title: String(r.title ?? ""),
    type: String(r.type ?? ""),
    date: dateOnly(r.date as string),
    time: timeOnly(r.time as string),
    location: optStr(r.location),
    caseId: optStr(r.case_id),
    clientId: optStr(r.client_id),
    enforcementId: optStr(r.enforcement_id),
    assigneeId: String(r.assignee_id),
    status: r.status as Reminder["status"],
    note: optStr(r.note),
    caseNo: optStr(r.case_no),
    parties: optStr(r.parties),
    excuse: optStr(r.excuse),
  };
}

export function reminderToRow(r: Partial<Reminder>) {
  const row: Record<string, unknown> = {};
  if (r.title != null) row.title = r.title;
  if (r.type != null) row.type = r.type;
  if (r.date != null) row.date = r.date;
  if (r.time !== undefined) row.time = r.time || null;
  if (r.location !== undefined) row.location = r.location || null;
  if (r.caseId !== undefined) row.case_id = r.caseId || null;
  if (r.clientId !== undefined) row.client_id = r.clientId || null;
  if (r.enforcementId !== undefined) row.enforcement_id = r.enforcementId || null;
  if (r.assigneeId != null) row.assignee_id = r.assigneeId;
  if (r.status != null) row.status = r.status;
  if (r.note !== undefined) row.note = r.note || null;
  if (r.caseNo !== undefined) row.case_no = r.caseNo || null;
  if (r.parties !== undefined) row.parties = r.parties || null;
  if (r.excuse !== undefined) row.excuse = r.excuse || null;
  return row;
}

export function documentFromRow(
  r: Record<string, unknown>,
  attachment: AttachmentRef,
): DocumentFile {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    name: String(r.name ?? ""),
    category: String(r.category ?? "Diğer"),
    attachment,
    caseId: optStr(r.case_id),
    clientId: optStr(r.client_id),
    enforcementId: optStr(r.enforcement_id),
    uploadedBy: String(r.uploaded_by ?? ""),
  };
}

export function documentToRow(d: Partial<DocumentFile> & { attachmentId?: string }) {
  const row: Record<string, unknown> = {};
  if (d.name != null) row.name = d.name;
  if (d.category != null) row.category = d.category;
  if (d.attachmentId != null) row.attachment_id = d.attachmentId;
  else if (d.attachment?.id) row.attachment_id = d.attachment.id;
  if (d.caseId !== undefined) row.case_id = d.caseId || null;
  if (d.clientId !== undefined) row.client_id = d.clientId || null;
  if (d.enforcementId !== undefined) row.enforcement_id = d.enforcementId || null;
  if (d.uploadedBy != null) row.uploaded_by = d.uploadedBy;
  return row;
}

export function notificationFromRow(r: Record<string, unknown>): AppNotification {
  return {
    id: String(r.id),
    firmId: String(r.org_id),
    createdAt: iso(r.created_at as string),
    updatedAt: iso(r.updated_at as string),
    userId: String(r.user_id),
    title: String(r.title ?? ""),
    detail: String(r.detail ?? ""),
    type: String(r.type ?? ""),
    read: Boolean(r.read),
    link: optStr(r.link),
  };
}

export function notificationToRow(n: Partial<AppNotification>) {
  const row: Record<string, unknown> = {};
  if (n.userId != null) row.user_id = n.userId;
  if (n.title != null) row.title = n.title;
  if (n.detail != null) row.detail = n.detail;
  if (n.type != null) row.type = n.type;
  if (n.read != null) row.read = n.read;
  if (n.link !== undefined) row.link = n.link || null;
  return row;
}

export function yearStatsFromRow(r: Record<string, unknown>): { year: number; stats: YearStats } {
  return {
    year: num(r.year),
    stats: {
      feeIncome: num(r.fee_income),
      icraCollected: num(r.icra_collected),
      officeExpense: num(r.office_expense),
      clientExpense: num(r.client_expense),
      otherIncome: num(r.other_income),
      otherExpense: num(r.other_expense),
      closedCases: num(r.closed_cases),
    },
  };
}
