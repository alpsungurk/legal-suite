/**
 * Excel ile toplu aktarım tanımları.
 *
 * Her tür için: şablon sütunları, satır doğrulaması (hata / uyarı / zaten kayıtlı) ve
 * onaylanan satırlardan kayıt üretimi. Ekranda satırlar metin olarak düzenlenir; her
 * değişiklikte satır yeniden doğrulanır.
 */
import type { Draft, ImportBatch } from "@/lib/erp-store";
import {
  type Account,
  type CaseFile,
  type Client,
  type Debtor,
  type EnforcementFile,
  type ErpState,
  type Permissions,
  type User,
} from "@/lib/erp-types";
import { caseCourtLabel } from "@/lib/finance";
import { formatDate, round2, today } from "@/lib/format";
import { excelSerialToISO, type RawCell } from "@/lib/excel-read";

export type ImportKind = "clients" | "cases" | "expenses" | "debtors" | "enforcements";

export type ColumnType = "text" | "money" | "date" | "enum" | "lookup" | "multi";

export type ImportColumn = {
  key: string;
  header: string;
  required?: boolean;
  type?: ColumnType;
  /** Şablon dışında kabul edilen başlıklar */
  aliases?: string[];
  /** Listede olmayan değer de kabul edilir (mahkeme, icra dairesi) */
  creatable?: boolean;
  /** Açılır liste değerleri (enum / lookup) */
  options?: (ctx: ImportContext) => string[];
  hint: string;
  example?: string;
  width?: number;
};

export type ImportContext = {
  state: ErpState;
  user: User;
  permissions: Permissions;
};

export type RowValues = Record<string, string>;

export type RowCheck = {
  errors: Record<string, string>;
  warnings: string[];
  /** Mevcut bir kayıtla aynı görünüyor (mükerrer kontrolü için anahtar) */
  existing?: string;
  /** Dosya içinde mükerrer kontrolü için anahtar */
  key?: string;
};

export type ImportSpec = {
  kind: ImportKind;
  title: string;
  /** "12 masraf" gibi metinler için */
  noun: string;
  description: string;
  columns: ImportColumn[];
  allowed: (p: Permissions) => boolean;
  /** Mevcut kayıtla aynıysa: true → kullanıcı isterse yine de aktarabilir, false → aktarılamaz */
  softDuplicates: boolean;
  check: (v: RowValues, ctx: ImportContext) => RowCheck;
  build: (rows: RowValues[], ctx: ImportContext) => ImportBatch;
};

/* ───────────── Ortak çözümleyiciler ───────────── */

export const norm = (s: string | undefined | null) =>
  (s ?? "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/** Başlık eşleştirme: büyük/küçük harf, yıldız, Türkçe karakter ve noktalama farkını yok sayar. */
export function headerKey(s: string) {
  return norm(s)
    .replace(/\*/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[çc]/g, "c")
    .replace(/[ğg]/g, "g")
    .replace(/[ıi]/g, "i")
    .replace(/[öo]/g, "o")
    .replace(/[şs]/g, "s")
    .replace(/[üu]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

/** Dropdown etiketlerindeki "no · açıklama" biçiminden ilk parçayı alır */
const firstPart = (s: string) => s.split("·")[0].trim();

/** "1.234,56 ₺", "1234.56", "1,234.56", "₺1.500" → sayı; geçersizse null */
export function parseAmount(input: string): number | null {
  let s = input.replace(/₺|TL|TRY|\s/gi, "");
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Son ayraç ondalıktır
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    s = s.replaceAll(thou, "").replace(dec, ".");
  } else if (lastComma >= 0) {
    s = (s.match(/,/g) ?? []).length > 1 ? s.replaceAll(",", "") : s.replace(",", ".");
  } else if (lastDot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replaceAll(".", "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

/** "12.10.2026", "12/10/2026", "2026-10-12", "12.10.26" → YYYY-AA-GG; geçersizse null */
export function parseDateText(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return date.toISOString().slice(0, 10);
}

const amountText = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Excel hücresini ekranda düzenlenecek metne çevirir */
export function cellToText(cell: RawCell, type: ColumnType | undefined, date1904: boolean): string {
  if (cell == null) return "";
  if (typeof cell === "boolean") return cell ? "Evet" : "Hayır";
  if (type === "date") {
    const iso = typeof cell === "number" ? excelSerialToISO(cell, date1904) : parseDateText(cell);
    return iso ? formatDate(iso) : String(cell).trim();
  }
  if (typeof cell === "number")
    return type === "money" ? amountText.format(round2(cell)) : String(round2(cell));
  return cell.replace(/\s+/g, " ").trim();
}

function matchOption(value: string, options: readonly string[]) {
  const k = headerKey(value);
  return options.find((o) => headerKey(o) === k);
}

type Errors = Record<string, string>;

function money(v: RowValues, key: string, errors: Errors, opts?: { required?: boolean }) {
  const raw = v[key]?.trim() ?? "";
  if (!raw) {
    if (opts?.required) errors[key] = "Tutar girin";
    return 0;
  }
  const n = parseAmount(raw);
  if (n == null) errors[key] = "Geçerli bir tutar girin (ör. 1.250,50)";
  else if (n < 0) errors[key] = "Tutar eksi olamaz";
  else if (opts?.required && n === 0) errors[key] = "Tutar sıfırdan büyük olmalı";
  return n ?? 0;
}

function date(v: RowValues, key: string, errors: Errors, opts?: { required?: boolean }) {
  const raw = v[key]?.trim() ?? "";
  if (!raw) {
    if (opts?.required) errors[key] = "Tarih girin";
    return today();
  }
  const iso = parseDateText(raw);
  if (!iso) errors[key] = "Tarih GG.AA.YYYY biçiminde olmalı";
  return iso ?? today();
}

function enumOf<T extends string>(
  v: RowValues,
  key: string,
  options: readonly T[],
  errors: Errors,
  fallback: T,
): T {
  const raw = v[key]?.trim() ?? "";
  if (!raw) return fallback;
  const found = matchOption(raw, options);
  if (!found)
    errors[key] =
      `Listeden seçin: ${options.slice(0, 6).join(", ")}${options.length > 6 ? "…" : ""}`;
  return (found as T) ?? fallback;
}

function required(v: RowValues, key: string, errors: Errors, msg = "Zorunlu alan") {
  const s = v[key]?.trim() ?? "";
  if (!s) errors[key] = msg;
  return s;
}

const opt = (s: string | undefined) => s?.trim() || undefined;

/* ───────────── Kayıt bulucular ───────────── */

function findClient(state: ErpState, value: string): { client?: Client; error?: string } {
  const k = norm(value);
  if (!k) return {};
  const byIdentity = state.clients.find((c) => c.identity && norm(c.identity) === k);
  if (byIdentity) return { client: byIdentity };
  const byName = state.clients.filter((c) => norm(c.name) === k);
  if (byName.length === 1) return { client: byName[0] };
  if (byName.length > 1)
    return { error: "Bu isimde birden fazla müvekkil var; TC / vergi no yazın" };
  return { error: "Müvekkil bulunamadı; önce müvekkili ekleyin veya listeden seçin" };
}

function findCase(state: ErpState, value: string): { kase?: CaseFile; error?: string } {
  const k = norm(firstPart(value)).replace(/\s/g, "");
  if (!k) return {};
  const kase = state.cases.find((c) => norm(c.no).replace(/\s/g, "") === k);
  return kase ? { kase } : { error: "Dosya bulunamadı; listeden seçin" };
}

function findEnforcement(
  state: ErpState,
  value: string,
): { enf?: EnforcementFile; error?: string } {
  const [noPart, officePart] = value.split("·").map((x) => norm(x));
  if (!noPart) return {};
  const byNo = state.enforcements.filter((e) => norm(e.no) === noPart);
  const exact = officePart ? byNo.filter((e) => norm(e.office) === officePart) : byNo;
  if (exact.length === 1) return { enf: exact[0] };
  if (byNo.length > 1)
    return { error: "Bu numarada birden fazla icra dosyası var; listeden seçin" };
  return { error: "İcra dosyası bulunamadı; listeden seçin" };
}

const stripTitle = (s: string) => norm(s).replace(/^av\.?\s*/, "");

function findUsers(state: ErpState, value: string): { ids: string[]; missing: string[] } {
  const names = value
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const u = state.users.find(
      (x) => stripTitle(x.name) === stripTitle(n) || norm(x.username) === norm(n),
    );
    if (u) ids.push(u.id);
    else missing.push(n);
  }
  return { ids: [...new Set(ids)], missing };
}

const isExpenseAccount = (a: Account) => a.type === "Kasa" || /baro\s*kart/i.test(a.name);

const clientLabel = (c: Client) => c.name;
const enforcementLabel = (e: EnforcementFile) => `${e.no} · ${e.office}`;

const lists = {
  clients: (ctx: ImportContext) => ctx.state.clients.map(clientLabel),
  cases: (ctx: ImportContext) => ctx.state.cases.map(caseCourtLabel),
  enforcements: (ctx: ImportContext) => ctx.state.enforcements.map(enforcementLabel),
  lawyers: (ctx: ImportContext) => ctx.state.users.filter((u) => u.active).map((u) => u.name),
};

/* ───────────── Müvekkiller ───────────── */

const clients: ImportSpec = {
  kind: "clients",
  title: "Müvekkiller",
  noun: "müvekkil",
  description: "Müvekkil kartlarını toplu ekleyin.",
  allowed: (p) => p.can("clients", "create"),
  softDuplicates: true,
  columns: [
    {
      key: "name",
      header: "Ad soyad / Ünvan",
      required: true,
      hint: "Kişi adı veya şirket ünvanı",
      example: "Ayşe Demir",
      width: 28,
      aliases: ["Ad soyad", "Ünvan", "Müvekkil", "Ad"],
    },
    {
      key: "kind",
      header: "Tür",
      type: "enum",
      options: () => ["Bireysel", "Kurumsal"],
      hint: "Bireysel veya Kurumsal (boşsa Bireysel)",
      example: "Bireysel",
    },
    {
      key: "identity",
      header: "TC / Vergi no",
      hint: "TC kimlik no veya vergi no",
      example: "12345678901",
      aliases: ["TC", "TCKN", "VKN", "Vergi no", "TC kimlik no"],
    },
    { key: "taxOffice", header: "Vergi dairesi", hint: "Kurumsal müvekkiller için" },
    { key: "phone", header: "Telefon", hint: "Ör. 0532 000 00 00", example: "0532 000 00 00" },
    { key: "email", header: "E-posta", hint: "Ör. ad@ornek.com", aliases: ["Eposta", "Mail"] },
    { key: "address", header: "Adres", hint: "Açık adres", width: 30 },
    {
      key: "monthlyFee",
      header: "Aylık ücret",
      type: "money",
      hint: "Kurumsal müvekkiller için aylık sabit ücret",
    },
    {
      key: "status",
      header: "Durum",
      type: "enum",
      options: () => ["Aktif", "Pasif"],
      hint: "Aktif veya Pasif (boşsa Aktif)",
    },
    { key: "notes", header: "Notlar", hint: "Serbest not", width: 30, aliases: ["Not"] },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const warnings: string[] = [];
    const name = required(v, "name", errors);
    const kind = enumOf(v, "kind", ["Bireysel", "Kurumsal"] as const, errors, "Bireysel");
    enumOf(v, "status", ["Aktif", "Pasif"] as const, errors, "Aktif");
    const fee = money(v, "monthlyFee", errors);
    if (fee > 0 && kind !== "Kurumsal")
      warnings.push("Aylık ücret yalnızca kurumsal müvekkillerde kullanılır; yok sayılacak");
    const email = v.email?.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Geçerli bir e-posta girin";
    const identity = norm(v.identity);
    const dup = ctx.state.clients.find(
      (c) =>
        (identity && c.identity && norm(c.identity) === identity) || norm(c.name) === norm(name),
    );
    return {
      errors,
      warnings,
      existing: dup ? `Kayıtlı müvekkil: ${dup.name}` : undefined,
      key: identity || norm(name),
    };
  },
  build(rows) {
    const out: Draft<"clients">[] = rows.map((v) => {
      const kind =
        matchOption(v.kind ?? "", ["Bireysel", "Kurumsal"]) === "Kurumsal"
          ? "Kurumsal"
          : "Bireysel";
      const fee = parseAmount(v.monthlyFee ?? "") ?? 0;
      return {
        name: v.name.trim(),
        kind,
        identity: opt(v.identity),
        taxOffice: kind === "Kurumsal" ? opt(v.taxOffice) : undefined,
        phone: v.phone?.trim() ?? "",
        email: v.email?.trim() ?? "",
        address: opt(v.address),
        monthlyFee: kind === "Kurumsal" && fee > 0 ? fee : undefined,
        monthlyFeeStartDate: kind === "Kurumsal" && fee > 0 ? today() : undefined,
        status: matchOption(v.status ?? "", ["Aktif", "Pasif"]) === "Pasif" ? "Pasif" : "Aktif",
        notes: opt(v.notes),
      };
    });
    return { clients: out };
  },
};

/* ───────────── Dosyalar ───────────── */

function nextCaseNumbers(cases: CaseFile[], count: number) {
  const year = new Date().getFullYear();
  const nums = cases
    .map((c) => c.no.match(new RegExp(`^${year}/(\\d+)`))?.[1])
    .filter(Boolean)
    .map(Number);
  const start = (nums.length ? Math.max(...nums) : 0) + 1;
  return Array.from({ length: count }, (_, i) => `${year}/${String(start + i).padStart(3, "0")}`);
}

const openCaseStatuses = (ctx: ImportContext) =>
  ctx.state.settings.caseStatuses.filter((s) => s !== "Kapalı");

const cases: ImportSpec = {
  kind: "cases",
  title: "Dosyalar",
  noun: "dosya",
  description: "Dava ve danışmanlık dosyalarını toplu ekleyin.",
  allowed: (p) => p.can("cases", "create"),
  softDuplicates: false,
  columns: [
    {
      key: "no",
      header: "Dosya no",
      hint: "Büro dosya numarası; boş bırakılırsa otomatik verilir",
      example: "2026/150",
      aliases: ["Büro dosya no", "No"],
    },
    {
      key: "title",
      header: "Konu",
      required: true,
      hint: "Dosya konusu",
      example: "Alacak davası",
      width: 26,
      aliases: ["Dosya konusu", "Dosya adı"],
    },
    {
      key: "client",
      header: "Müvekkil",
      required: true,
      type: "lookup",
      options: lists.clients,
      hint: "Kayıtlı müvekkil adı veya TC / vergi no",
      width: 26,
    },
    {
      key: "type",
      header: "Dosya türü",
      type: "enum",
      options: (c) => c.state.settings.caseTypes,
      hint: "Ayarlar'daki dosya türlerinden biri (boşsa ilki)",
      aliases: ["Tür"],
    },
    {
      key: "status",
      header: "Durum",
      type: "enum",
      options: openCaseStatuses,
      hint: "Açık, Derdest, Karar veya Kanun yolu (boşsa Açık)",
    },
    {
      key: "court",
      header: "Mahkeme",
      type: "lookup",
      creatable: true,
      options: (c) => c.state.settings.courts,
      hint: "Listeden seçin veya yazın; yeni mahkeme listeye eklenir",
      example: "İstanbul 3. Asliye Hukuk",
      width: 28,
      aliases: ["Mahkeme / merci", "Merci"],
    },
    { key: "esasNo", header: "Esas no", hint: "Ör. 2026/412 E." },
    { key: "opposingParty", header: "Karşı taraf", hint: "Karşı taraf adı", width: 24 },
    {
      key: "responsible",
      header: "Sorumlu avukat",
      type: "multi",
      options: lists.lawyers,
      hint: "Kullanıcı adı soyadı; birden fazlaysa ; ile ayırın",
      width: 24,
      aliases: ["Sorumlu", "Avukat"],
    },
    {
      key: "openingDate",
      header: "Açılış tarihi",
      type: "date",
      hint: "GG.AA.YYYY (boşsa bugün)",
      example: "12.10.2026",
    },
    {
      key: "agreedFee",
      header: "Anlaşılan ücret",
      type: "money",
      hint: "Bilgi amaçlı vekalet ücreti",
      aliases: ["Vekalet ücreti"],
    },
    { key: "note", header: "Not", hint: "Serbest not", width: 30 },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const warnings: string[] = [];
    required(v, "title", errors);
    if (required(v, "client", errors)) {
      const r = findClient(ctx.state, v.client);
      if (r.error) errors.client = r.error;
    }
    enumOf(v, "type", ctx.state.settings.caseTypes, errors, ctx.state.settings.caseTypes[0]);
    if (v.status && headerKey(v.status) === headerKey("Kapalı"))
      errors.status = "Kapalı dosya aktarılamaz";
    else enumOf(v, "status", openCaseStatuses(ctx), errors, "Açık");
    date(v, "openingDate", errors);
    money(v, "agreedFee", errors);
    if (v.responsible?.trim()) {
      const u = findUsers(ctx.state, v.responsible);
      if (u.missing.length) errors.responsible = `Kullanıcı bulunamadı: ${u.missing.join(", ")}`;
    }
    const no = norm(v.no).replace(/\s/g, "");
    const dup = no ? ctx.state.cases.find((c) => norm(c.no).replace(/\s/g, "") === no) : undefined;
    if (!no) warnings.push("Dosya no otomatik verilecek");
    return {
      errors,
      warnings,
      existing: dup ? `Bu dosya no zaten kayıtlı: ${dup.no}` : undefined,
      key: no || undefined,
    };
  },
  build(rows, ctx) {
    const auto = nextCaseNumbers(ctx.state.cases, rows.filter((v) => !v.no?.trim()).length);
    const out: Draft<"cases">[] = rows.map((v) => ({
      no: v.no?.trim() || auto.shift()!,
      title: v.title.trim(),
      clientId: findClient(ctx.state, v.client).client?.id,
      type:
        matchOption(v.type ?? "", ctx.state.settings.caseTypes) ?? ctx.state.settings.caseTypes[0],
      status: (matchOption(v.status ?? "", openCaseStatuses(ctx)) ?? "Açık") as CaseFile["status"],
      court: opt(v.court),
      esasNo: opt(v.esasNo),
      opposingParty: opt(v.opposingParty),
      responsibleIds: v.responsible?.trim()
        ? findUsers(ctx.state, v.responsible).ids
        : ctx.user.role === "Avukat"
          ? [ctx.user.id]
          : [],
      openingDate: parseDateText(v.openingDate ?? "") ?? today(),
      agreedFee: parseAmount(v.agreedFee ?? "") || undefined,
      note: opt(v.note),
    }));
    return { cases: out };
  },
};

/* ───────────── Masraflar ───────────── */

const CHARGE = ["Müvekkil", "Büro"] as const;
const PAID_BY = ["Büro", "Müvekkil"] as const;

function chargeOf(raw: string): (typeof CHARGE)[number] | undefined {
  const k = headerKey(raw);
  if (!k) return undefined;
  if (["muvekkil", "dosya", "dosyamasrafi", "muvekkildosyamasrafi", "muvekkilmasrafi"].includes(k))
    return "Müvekkil";
  if (["buro", "burogideri", "buromasrafi"].includes(k)) return "Büro";
  return undefined;
}

function paidByOf(raw: string): (typeof PAID_BY)[number] | undefined {
  const k = headerKey(raw);
  if (!k) return undefined;
  if (["buro", "buroodedi", "burokasasi"].includes(k)) return "Büro";
  if (["muvekkil", "muvekkilodedi", "muvekkilkendisiodedi", "kendisi"].includes(k))
    return "Müvekkil";
  return undefined;
}

type ExpenseResolved = {
  chargeTo: (typeof CHARGE)[number];
  paidBy: (typeof PAID_BY)[number];
  caseId?: string;
  enforcementId?: string;
  clientId?: string;
  accountId?: string;
  amount: number;
  date: string;
  type: string;
};

function resolveExpense(v: RowValues, ctx: ImportContext, errors: Errors): ExpenseResolved {
  const s = ctx.state;
  const amount = money(v, "amount", errors, { required: true });
  const d = date(v, "date", errors, { required: true });
  const type = enumOf(v, "type", s.settings.expenseTypes, errors, s.settings.expenseTypes[0]);
  if (!v.type?.trim()) errors.type = "Masraf türü seçin";
  required(v, "title", errors);

  const kase = v.case?.trim() ? findCase(s, v.case) : {};
  if (kase.error) errors.case = kase.error;
  const enf = v.enforcement?.trim() ? findEnforcement(s, v.enforcement) : {};
  if (enf.error) errors.enforcement = enf.error;
  const cl = v.client?.trim() ? findClient(s, v.client) : {};
  if (cl.error) errors.client = cl.error;

  const explicit = v.chargeTo?.trim() ? chargeOf(v.chargeTo) : undefined;
  if (v.chargeTo?.trim() && !explicit) errors.chargeTo = "Müvekkil veya Büro yazın";
  const chargeTo =
    explicit ?? (v.case?.trim() || v.enforcement?.trim() || v.client?.trim() ? "Müvekkil" : "Büro");

  let clientId: string | undefined;
  if (chargeTo === "Müvekkil") {
    const ids = [kase.kase?.clientId, enf.enf?.clientId, cl.client?.id].filter(Boolean);
    clientId = ids[0];
    if (new Set(ids).size > 1)
      errors.client = "Dosya / icra dosyası ile müvekkil birbiriyle uyuşmuyor";
    else if (!clientId && !errors.case && !errors.enforcement && !errors.client)
      errors.client = "Müvekkil masrafında dosya, icra dosyası veya müvekkil girin";
  }

  const explicitPaid = v.paidBy?.trim() ? paidByOf(v.paidBy) : undefined;
  if (v.paidBy?.trim() && !explicitPaid) errors.paidBy = "Büro veya Müvekkil yazın";
  const paidBy = chargeTo === "Büro" ? "Büro" : (explicitPaid ?? "Büro");

  let accountId: string | undefined;
  if (paidBy === "Büro") {
    const accounts = s.accounts.filter((a) => a.active && isExpenseAccount(a));
    const raw = v.account?.trim();
    const acc = raw
      ? accounts.find((a) => norm(a.name) === norm(raw))
      : (accounts.find((a) => a.type === "Kasa") ?? accounts[0]);
    if (raw && !acc) errors.account = "Masraflar yalnızca Büro Kasası veya Barokart'tan ödenir";
    accountId = acc?.id;
  }

  return {
    chargeTo,
    paidBy,
    caseId: chargeTo === "Müvekkil" ? kase.kase?.id : undefined,
    enforcementId: chargeTo === "Müvekkil" ? enf.enf?.id : undefined,
    clientId,
    accountId,
    amount,
    date: d,
    type,
  };
}

const expenses: ImportSpec = {
  kind: "expenses",
  title: "Masraflar",
  noun: "masraf",
  description: "Dosya masraflarını ve büro giderlerini toplu ekleyin.",
  allowed: (p) => p.can("expenses", "create"),
  softDuplicates: true,
  columns: [
    {
      key: "date",
      header: "Tarih",
      required: true,
      type: "date",
      hint: "GG.AA.YYYY",
      example: "12.10.2026",
    },
    {
      key: "type",
      header: "Masraf türü",
      required: true,
      type: "enum",
      options: (c) => c.state.settings.expenseTypes,
      hint: "Ayarlar'daki masraf türlerinden biri",
      example: "Harç",
      aliases: ["Tür"],
    },
    {
      key: "title",
      header: "Açıklama",
      required: true,
      hint: "Masrafın açıklaması",
      example: "Başvuru harcı",
      width: 28,
    },
    {
      key: "amount",
      header: "Tutar",
      required: true,
      type: "money",
      hint: "Ör. 1.250,50",
      example: "1250,50",
    },
    {
      key: "chargeTo",
      header: "Ait olduğu",
      type: "enum",
      options: () => [...CHARGE],
      hint: "Müvekkil (dosya masrafı) veya Büro (büro gideri). Boşsa dosya/müvekkil varsa Müvekkil, yoksa Büro",
      aliases: ["Kime ait", "Masraf kime ait"],
    },
    {
      key: "case",
      header: "Dosya",
      type: "lookup",
      options: lists.cases,
      hint: "Dosya no (listede dosya no · mahkeme)",
      width: 30,
      aliases: ["Dosya no"],
    },
    {
      key: "enforcement",
      header: "İcra dosyası",
      type: "lookup",
      options: lists.enforcements,
      hint: "İcra dosya no (listede no · icra dairesi)",
      width: 28,
      aliases: ["İcra dosya no", "İcra"],
    },
    {
      key: "client",
      header: "Müvekkil",
      type: "lookup",
      options: lists.clients,
      hint: "Dosya seçildiyse boş bırakılabilir",
      width: 24,
    },
    {
      key: "paidBy",
      header: "Ödeyen",
      type: "enum",
      options: () => [...PAID_BY],
      hint: "Büro (müvekkile yansır) veya Müvekkil (kendisi ödedi). Boşsa Büro",
      aliases: ["Ödemeyi kim yaptı"],
    },
    {
      key: "account",
      header: "Ödenen hesap",
      type: "lookup",
      options: (c) =>
        c.state.accounts.filter((a) => a.active && isExpenseAccount(a)).map((a) => a.name),
      hint: "Büro Kasası veya Barokart (boşsa Büro Kasası)",
      aliases: ["Hesap", "Ödendiği hesap"],
    },
    { key: "note", header: "Not", hint: "Serbest not", width: 28 },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const r = resolveExpense(v, ctx, errors);
    const dup = ctx.state.expenses.find(
      (e) =>
        e.date === r.date &&
        Math.abs(e.amount - r.amount) < 0.005 &&
        norm(e.title) === norm(v.title) &&
        (e.clientId ?? "") === (r.clientId ?? ""),
    );
    return {
      errors,
      warnings: [],
      existing: dup ? "Aynı tarih, tutar ve açıklamayla masraf zaten var" : undefined,
      key: [r.date, r.amount, norm(v.title), r.clientId ?? ""].join("|"),
    };
  },
  build(rows, ctx) {
    const out: Draft<"expenses">[] = rows.map((v) => {
      const r = resolveExpense(v, ctx, {});
      return {
        title: v.title.trim(),
        type: r.type,
        amount: r.amount,
        date: r.date,
        chargeTo: r.chargeTo,
        paidBy: r.paidBy,
        caseId: r.caseId,
        enforcementId: r.enforcementId,
        clientId: r.chargeTo === "Müvekkil" ? r.clientId : undefined,
        accountId: r.paidBy === "Büro" ? r.accountId : undefined,
        receipts: [],
        note: opt(v.note),
        createdBy: ctx.user.id,
      };
    });
    return { expenses: out };
  },
};

/* ───────────── Borçlular ───────────── */

const debtors: ImportSpec = {
  kind: "debtors",
  title: "Borçlular",
  noun: "borçlu",
  description: "İcra takiplerindeki borçluları toplu ekleyin.",
  allowed: (p) => p.can("enforcements", "create"),
  softDuplicates: true,
  columns: [
    {
      key: "name",
      header: "Ad soyad / Ünvan",
      required: true,
      hint: "Borçlu kişi veya şirket",
      example: "Mehmet Yılmaz",
      width: 28,
      aliases: ["Ad soyad", "Ünvan", "Borçlu"],
    },
    {
      key: "kind",
      header: "Tür",
      type: "enum",
      options: () => ["Bireysel", "Kurumsal"],
      hint: "Bireysel veya Kurumsal (boşsa Bireysel)",
    },
    {
      key: "identity",
      header: "TC / Vergi no",
      hint: "TC kimlik no veya vergi no",
      aliases: ["TC", "TCKN", "VKN", "Vergi no"],
    },
    { key: "phone", header: "Telefon", hint: "Ör. 0532 000 00 00" },
    { key: "email", header: "E-posta", hint: "Ör. ad@ornek.com", aliases: ["Eposta", "Mail"] },
    { key: "address", header: "Adres", hint: "Tebligat adresi", width: 30 },
    { key: "assets", header: "Mal varlığı", hint: "Araç, taşınmaz, maaş bilgisi vb.", width: 28 },
    { key: "notes", header: "Notlar", hint: "Serbest not", width: 28, aliases: ["Not"] },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const name = required(v, "name", errors);
    enumOf(v, "kind", ["Bireysel", "Kurumsal"] as const, errors, "Bireysel");
    const email = v.email?.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Geçerli bir e-posta girin";
    const identity = norm(v.identity);
    const dup = ctx.state.debtors.find(
      (d) =>
        (identity && d.identity && norm(d.identity) === identity) || norm(d.name) === norm(name),
    );
    return {
      errors,
      warnings: [],
      existing: dup ? `Kayıtlı borçlu: ${dup.name}` : undefined,
      key: identity || norm(name),
    };
  },
  build(rows) {
    const out: Draft<"debtors">[] = rows.map((v) => ({
      name: v.name.trim(),
      kind:
        matchOption(v.kind ?? "", ["Bireysel", "Kurumsal"]) === "Kurumsal"
          ? "Kurumsal"
          : "Bireysel",
      identity: opt(v.identity),
      phone: opt(v.phone),
      email: opt(v.email),
      address: opt(v.address),
      assets: opt(v.assets),
      notes: opt(v.notes),
    }));
    return { debtors: out };
  },
};

/* ───────────── İcra dosyaları ───────────── */

function splitNames(value: string) {
  return value
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function findDebtor(state: ErpState, name: string): Debtor | undefined {
  const k = norm(name);
  return (
    state.debtors.find((d) => d.identity && norm(d.identity) === k) ??
    state.debtors.find((d) => norm(d.name) === k)
  );
}

const enforcements: ImportSpec = {
  kind: "enforcements",
  title: "İcra dosyaları",
  noun: "icra dosyası",
  description: "İcra takiplerini toplu ekleyin. Kayıtlı olmayan borçlular otomatik oluşturulur.",
  allowed: (p) => p.can("enforcements", "create"),
  softDuplicates: false,
  columns: [
    {
      key: "no",
      header: "İcra dosya no",
      required: true,
      hint: "Ör. 2026/1234 E.",
      example: "2026/1234 E.",
      aliases: ["Dosya no", "Esas no", "No"],
    },
    {
      key: "office",
      header: "İcra dairesi",
      required: true,
      type: "lookup",
      creatable: true,
      options: (c) => c.state.settings.enforcementOffices,
      hint: "Listeden seçin veya yazın; yeni daire listeye eklenir",
      example: "İstanbul 12. İcra Dairesi",
      width: 28,
      aliases: ["Daire"],
    },
    {
      key: "type",
      header: "Takip türü",
      type: "enum",
      options: (c) => c.state.settings.enforcementTypes,
      hint: "İlamsız, İlamlı, Kambiyo, Rehin, Kira, Diğer (boşsa İlamsız)",
      aliases: ["Tür"],
    },
    {
      key: "client",
      header: "Alacaklı müvekkil",
      required: true,
      type: "lookup",
      options: lists.clients,
      hint: "Kayıtlı müvekkil adı veya TC / vergi no",
      width: 26,
      aliases: ["Müvekkil", "Alacaklı"],
    },
    {
      key: "debtors",
      header: "Borçlular",
      required: true,
      type: "multi",
      hint: "Borçlu adları; birden fazlaysa ; ile ayırın. Kayıtlı değilse oluşturulur",
      example: "Mehmet Yılmaz",
      width: 28,
      aliases: ["Borçlu"],
    },
    {
      key: "principal",
      header: "Asıl alacak",
      required: true,
      type: "money",
      hint: "Ör. 85.000",
      example: "85000",
      aliases: ["Asıl", "Alacak"],
    },
    { key: "interest", header: "Faiz", type: "money", hint: "İşlemiş faiz (boşsa 0)" },
    {
      key: "costs",
      header: "Takip masrafı",
      type: "money",
      hint: "Takip masrafları (boşsa 0)",
      aliases: ["Masraf"],
    },
    {
      key: "status",
      header: "Durum",
      type: "enum",
      options: (c) => c.state.settings.enforcementStatuses,
      hint: "Boşsa Derdest",
    },
    {
      key: "openingDate",
      header: "Takip tarihi",
      type: "date",
      hint: "GG.AA.YYYY (boşsa bugün)",
      aliases: ["Açılış tarihi", "Tarih"],
    },
    {
      key: "responsible",
      header: "Sorumlu avukat",
      type: "multi",
      options: lists.lawyers,
      hint: "Birden fazlaysa ; ile ayırın",
      width: 22,
      aliases: ["Sorumlu"],
    },
    {
      key: "case",
      header: "İlgili dosya",
      type: "lookup",
      options: lists.cases,
      hint: "İsteğe bağlı; dava dosya no",
      width: 28,
    },
    { key: "note", header: "Not", hint: "Serbest not", width: 28 },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const warnings: string[] = [];
    const s = ctx.state;
    const no = required(v, "no", errors);
    const office = required(v, "office", errors);
    enumOf(v, "type", s.settings.enforcementTypes, errors, s.settings.enforcementTypes[0]);
    enumOf(v, "status", s.settings.enforcementStatuses, errors, "Derdest");
    let clientId: string | undefined;
    if (required(v, "client", errors)) {
      const r = findClient(s, v.client);
      if (r.error) errors.client = r.error;
      clientId = r.client?.id;
    }
    if (required(v, "debtors", errors, "En az bir borçlu girin")) {
      const fresh = splitNames(v.debtors).filter((n) => !findDebtor(s, n));
      if (fresh.length) warnings.push(`Yeni borçlu oluşturulacak: ${fresh.join(", ")}`);
    }
    money(v, "principal", errors, { required: true });
    money(v, "interest", errors);
    money(v, "costs", errors);
    date(v, "openingDate", errors);
    if (v.responsible?.trim()) {
      const u = findUsers(s, v.responsible);
      if (u.missing.length) errors.responsible = `Kullanıcı bulunamadı: ${u.missing.join(", ")}`;
    }
    if (v.case?.trim()) {
      const r = findCase(s, v.case);
      if (r.error) errors.case = r.error;
      else if (clientId && r.kase?.clientId !== clientId)
        errors.case = "Dosya bu müvekkile ait değil";
    }
    const dup = s.enforcements.find(
      (e) => norm(e.no) === norm(no) && norm(e.office) === norm(office),
    );
    return {
      errors,
      warnings,
      existing: dup ? `Bu icra dosyası zaten kayıtlı: ${dup.no}` : undefined,
      key: `${norm(no)}|${norm(office)}`,
    };
  },
  build(rows, ctx) {
    const s = ctx.state;
    const created = new Map<string, Draft<"debtors"> & { id: string }>();
    const debtorId = (name: string) => {
      const existing = findDebtor(s, name);
      if (existing) return existing.id;
      const k = norm(name);
      if (!created.has(k))
        created.set(k, {
          id: `dbt-${Date.now().toString(36)}-${created.size}-${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim(),
          kind: "Bireysel",
        });
      return created.get(k)!.id;
    };
    const out: Draft<"enforcements">[] = rows.map((v) => ({
      no: v.no.trim(),
      office: v.office.trim(),
      type:
        matchOption(v.type ?? "", s.settings.enforcementTypes) ?? s.settings.enforcementTypes[0],
      clientId: findClient(s, v.client).client!.id,
      debtorIds: [...new Set(splitNames(v.debtors).map(debtorId))],
      principal: parseAmount(v.principal) ?? 0,
      interest: parseAmount(v.interest ?? "") ?? 0,
      costs: parseAmount(v.costs ?? "") ?? 0,
      status: (matchOption(v.status ?? "", s.settings.enforcementStatuses) ??
        "Derdest") as EnforcementFile["status"],
      openingDate: parseDateText(v.openingDate ?? "") ?? today(),
      responsibleIds: v.responsible?.trim()
        ? findUsers(s, v.responsible).ids
        : ctx.user.role === "Avukat"
          ? [ctx.user.id]
          : [],
      caseId: v.case?.trim() ? findCase(s, v.case).kase?.id : undefined,
      note: opt(v.note),
    }));
    return { debtors: [...created.values()], enforcements: out };
  },
};

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  clients,
  cases,
  expenses,
  debtors,
  enforcements,
};

export const IMPORT_ORDER: ImportKind[] = [
  "clients",
  "cases",
  "expenses",
  "debtors",
  "enforcements",
];
