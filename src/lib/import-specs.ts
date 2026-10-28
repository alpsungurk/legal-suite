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
  DEFAULT_ENFORCEMENT_STATUS,
  STOPPED_ENFORCEMENT_STATUS,
  CLOSED_ENFORCEMENT_STATUS,
  parseEnforcementStatus,
  type Debtor,
  type EnforcementFile,
  type EnforcementSide,
  type ErpState,
  type Permissions,
  type Reminder,
  type User,
} from "@/lib/erp-types";
import { caseCourtLabel } from "@/lib/finance";
import { fileNoKey, formatDate, normalizeFileNo, round2, today } from "@/lib/format";
import { newId } from "@/lib/mappers";
import { excelSerialToISO, type RawCell } from "@/lib/excel-read";
import {
  clientPartiesText,
  isTalimatFile,
  matchClients,
  parseUyapParties,
  roleLabel,
  talimatActivity,
} from "@/lib/uyap";

export type ImportKind =
  | "clients"
  | "cases"
  | "expenses"
  | "reminders"
  | "debtors"
  | "banks"
  | "enforcements"
  | "enforcementsOwed";

export type ColumnType = "text" | "money" | "date" | "time" | "enum" | "lookup" | "multi";

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
  /** Çok satırlı metin: satır sonları korunur, önizlemede geniş kutu */
  multiline?: boolean;
};

export type ImportContext = {
  state: ErpState;
  user: User;
  permissions: Permissions;
  /** Şirket sayfası aktarımında seçilen müvekkil (ör. ABC İnşaat, XYZ Lojistik). Satır tarafını ve müvekkili belirler. */
  companyClient?: string;
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
  /** Kayıtlı satır hata sayılmaz; Excel'deki değişikliklerle kayıt güncellenir (icra) */
  updatable?: boolean;
  check: (v: RowValues, ctx: ImportContext) => RowCheck;
  build: (rows: RowValues[], ctx: ImportContext) => ImportBatch;
  /** Bilgi taşımayan sütunlar (UYAP'ın "Görüntüle", "Takvime Ekle" düğmeleri): nota eklenmez */
  ignoreHeaders?: string[];
  /**
   * Başlığı boş sütun: ilk dolu hücrelere bakıp hangi alan olduğunu söyler (büronun elle tuttuğu
   * listelerde müvekkil / durum / açıklama sütunlarının başlığı olmayabiliyor). used: eşlenmiş alanlar.
   */
  guessColumn?: (samples: string[], used: Set<string>) => string | undefined;
  /**
   * Kayıtlı kayıt (check().existing) Excel'de değişmişse güncelleme planı: değişenler ekranda
   * "eski → yeni" gösterilir, batch kayda yazılır. Verilmezse kayıtlı satır aktarılmaz.
   */
  planUpdate?: (
    v: RowValues,
    ctx: ImportContext,
  ) => { changes: FieldChange[]; blocked: boolean; batch: ImportBatch } | null;
  /** Hazır şablon dosyası: verilirse "Şablon" düğmesi bu dosyayı olduğu gibi indirir (public/ altında) */
  templateFile?: { url: string; filename: string };
};

/** Güncellemede ekranda gösterilen değişiklik: "Durum: Açık → Kapalı" */
export type FieldChange = { label: string; from: string; to: string };

const lineKey = (l: string) => l.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");

/** Kayıttaki metin korunur; Excel'de olup kayıtta olmayan satırlar sona eklenir */
export function mergeText(current = "", incoming = ""): string {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming;
  const have = new Set(current.split("\n").map(lineKey).filter(Boolean));
  const add = incoming.split("\n").filter((l) => lineKey(l) && !have.has(lineKey(l)));
  return add.length ? `${current.trimEnd()}\n${add.join("\n")}` : current;
}

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

/** "1.234,56 ₺", "1234.56", "1,234.56", "₺1.500", "2.642,00-TL" → sayı; geçersizse null */
export function parseAmount(input: string): number | null {
  let s = input
    .replace(/₺|TL|TRY/gi, "")
    .replace(/\s/g, "")
    .replace(/^-+|-+$/g, "");
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

/** "12.10.2026", "12/10/2026", "2026-10-12", "12.10.26", "02.06.2025 18:23:00" → YYYY-AA-GG; geçersizse null */
export function parseDateText(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d)
    return null;
  return date.toISOString().slice(0, 10);
}

/** "10:30", "10.30", "9:05", "02.11.2026 10:30" → "10:30"; geçersizse null */
export function parseTimeText(input: string): string | null {
  const m = input.trim().match(/(?:^|\s)(\d{1,2})[:.,](\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Metindeki GG.AA.YYYY tarihlerinin en yenisi (son haciz listesi hücreleri için) */
export function latestDateIn(text: string): string | null {
  let best: string | null = null;
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const iso = parseDateText(`${m[1]}.${m[2]}.${m[3]}`);
    if (iso && (!best || iso > best)) best = iso;
  }
  return best;
}

/** Adın diğer metinde geçip geçmediği (ABC ↔ ABC LOJİSTİK) */
export function nameMentions(haystack: string, needle: string) {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n) return false;
  if (h.includes(n) || n.includes(h)) return true;
  return splitNames(haystack).some((part) => {
    const p = norm(part);
    return p.includes(n) || n.includes(p);
  });
}

/**
 * Alacaklı hücresinden müvekkil + nota gidecek bilgi.
 * Parantezdeki rol (Diğer Haciz Alacaklısı / Üçüncü şahıs) → şirket müvekkil;
 * "1- A 2- B" → ilk isim müvekkil, diğerleri nota.
 */
export function parseClientCell(raw: string, companyHint?: string) {
  const text = raw.trim();
  const noteParts: string[] = [];
  let clientName = "";
  let working = text;

  const roleRe =
    /\(([^)]*(?:di[gğ]er\s*haciz|[uü][cç][uü]nc[uü]\s*[sş]ah[iı]s|rehin\s*alacakl)[^)]*)\)/gi;
  const roles = [...text.matchAll(roleRe)];
  if (roles.length) {
    for (const m of roles) {
      noteParts.push(m[0].slice(1, -1).trim());
      const labeled = m[1].match(/:\s*(.+)$/);
      if (labeled && !clientName) {
        const cand = labeled[1].replace(/\s+/g, " ").trim();
        // Parantezdeki şirket adı (ilk anlamlı parça)
        clientName = cand.split(/[,;]/)[0]?.trim() || cand;
      }
    }
    working = text.replace(roleRe, " ").replace(/\s+/g, " ").trim();
  }

  const names = splitNames(working);
  if (!clientName && companyHint && nameMentions(text, companyHint))
    clientName = companyHint.trim();
  if (!clientName && names.length) {
    clientName = names[0];
    if (names.length > 1) noteParts.push(`Diğer alacaklılar: ${names.slice(1).join("; ")}`);
  } else if (clientName && names.length) {
    const others = names.filter(
      (n) => norm(n) !== norm(clientName) && !nameMentions(n, clientName),
    );
    if (others.length) noteParts.push(`Asıl / diğer alacaklılar: ${others.join("; ")}`);
  }

  if (companyHint?.trim()) clientName = companyHint.trim();

  return {
    clientName: clientName.trim(),
    noteExtra: noteParts.filter(Boolean).join("\n"),
    raw: text,
  };
}

const amountText = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Excel hücresini ekranda düzenlenecek metne çevirir */
export function cellToText(
  cell: RawCell,
  type: ColumnType | undefined,
  date1904: boolean,
  multiline = false,
): string {
  if (cell == null) return "";
  if (typeof cell === "boolean") return cell ? "Evet" : "Hayır";
  if (type === "date") {
    const iso = typeof cell === "number" ? excelSerialToISO(cell, date1904) : parseDateText(cell);
    if (!iso) return String(cell).trim();
    // Hücrede saat de varsa korunur ("02.11.2026 09:45"); tarih çözücüler saati yok sayar
    const time =
      typeof cell === "number"
        ? cell % 1 > 0.0001 && cellToText(cell, "time", date1904)
        : parseTimeText(cell);
    return time ? `${formatDate(iso)} ${time}` : formatDate(iso);
  }
  // Excel saati günün kesri olarak tutar (0,4375 = 10:30)
  if (type === "time") {
    if (typeof cell === "number") {
      const mins = Math.round((((cell % 1) + 1) % 1) * 1440) % 1440;
      return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    }
    return parseTimeText(cell) ?? cell.trim();
  }
  if (typeof cell === "number")
    return type === "money" ? amountText.format(round2(cell)) : String(round2(cell));
  if (multiline)
    return cell
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
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

/**
 * Dosya listelerinde müvekkil: aynı adla birden çok kart varsa ilki kullanılır (yeni kart açılıp
 * mükerrer çoğalmasın); TC / vergi no da eşleşir.
 */
function clientByName(state: ErpState, name: string) {
  return findClient(state, name).client ?? state.clients.find((c) => norm(c.name) === norm(name));
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
  const [noRaw, officeRaw] = value.split("·");
  const noPart = fileNoKey(noRaw ?? "");
  const officePart = norm(officeRaw);
  if (!noPart) return {};
  const byNo = state.enforcements.filter((e) => fileNoKey(e.no) === noPart);
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

/**
 * Büro listelerindeki mahkeme kısaltmalarını açar (küçük harf): "ANK. 9.SULH" → "ankara 9. sulh
 * hukuk", "ANK. 27.AHM" → "ankara 27. asliye hukuk mahkemesi", "ANK. 1. İD" → "ankara 1. idare
 * mahkemesi". Kısaltmanın sonu \b ile değil boşluk / metin sonuyla bulunur (Türkçe harflerde \b
 * çalışmaz).
 */
const courtish =
  /mahkeme|\bmah\b|idare|vergi|asliye|sulh|icra|\bceza\b|hukuk|\biş\b|\b(ahm|shm|id|ascm|acm)\b/i;

/**
 * Parantezli mahkeme:
 * "Ankara 15. İdare (ANKARA 8. İDARE)" → asıl ad + önceki mahkeme.
 * "Tazminat Komisyonu (Ankara 20. Ağır Ceza)" → parantezdeki mahkeme asıl addır.
 */
function splitPreviousCourt(raw: string): { name: string; previous?: string; label?: string } {
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { name: raw.trim() };
  const outside = m[1].trim();
  const inside = m[2].trim();
  if (courtish.test(outside) && courtish.test(inside)) return { name: outside, previous: inside };
  if (!courtish.test(outside) && courtish.test(inside)) return { name: inside, label: outside };
  return { name: raw.trim() };
}

function titleWord(w: string) {
  if (/^(cbs|bam)$/i.test(w)) return w.toLocaleUpperCase("tr");
  const i = w.search(/[A-Za-zÇĞİÖŞÜçğıöşü]/);
  if (i < 0) return w;
  return w.slice(0, i) + w.charAt(i).toLocaleUpperCase("tr") + w.slice(i + 1);
}

export function expandCourt(court: string | undefined, bias?: "ceza") {
  const end = "(?=\\s|$)";
  const rules: Array<[RegExp, string]> = [
    [/\bank\b\.?/g, " ankara "],
    [/\bist\b\.?/g, " istanbul "],
    [/batı\./g, "batı "],
    [/asliye(ceza|hukuk|ticaret)/g, "asliye $1"],
    [/(\d+)\s*\.?\s*/g, " $1. "],
    [new RegExp(`\\bas?cm\\.?${end}`, "g"), "asliye ceza mahkemesi"],
    [new RegExp(`\\basl\\.?\\s*c\\.?${end}`, "g"), "asliye ceza"],
    [new RegExp(`\\b(ahm|ashm|ash)\\.?${end}`, "g"), "asliye hukuk mahkemesi"],
    [new RegExp(`\\basl\\.?\\s*h\\.?${end}`, "g"), "asliye hukuk"],
    [new RegExp(`\\bshm\\.?${end}`, "g"), "sulh hukuk mahkemesi"],
    [new RegExp(`\\b(ihm|icrh|icr)\\.?${end}`, "g"), "icra hukuk mahkemesi"],
    [new RegExp(`\\batm\\.?${end}`, "g"), "asliye ticaret mahkemesi"],
    [new RegExp(`\\bid\\.?${end}`, "g"), "idare mahkemesi"],
    [new RegExp(`\\basl\\.?${end}`, "g"), "asliye"],
    [/\bsulh(?!\s*(hukuk|ceza))/g, "sulh hukuk"],
    [new RegExp(`\\bmah\\.?${end}`, "g"), "mahkemesi"],
  ];
  let s = norm(court);
  for (const [re, to] of rules) s = s.replace(re, to);
  // Sıra numarasının noktası ("9.") dışındaki noktalar atılır ("Sorgun.", "Ank . 6")
  s = s
    .replace(/(?<!\d)\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Yalın "asliye" hukuk listesinde asliye hukuk; CMK açıklaması varsa asliye ceza
  if (/\basliye\b/.test(s) && !/\basliye\s+(hukuk|ceza|ticaret)\b/.test(s))
    s = s.replace(/\basliye\b/, bias === "ceza" ? "asliye ceza" : "asliye hukuk");
  return s;
}

/**
 * Mahkeme karşılaştırma anahtarı: aynı mahkemenin farklı yazımları aynı anahtarı verir
 * ("ANK. 9. SULH" = "ANKARA 9. SHM" = "Ankara 9. Sulh Hukuk Mahkemesi").
 */
export function courtKey(court: string | undefined, bias?: "ceza") {
  return expandCourt(court, bias)
    .replace(/mahkemesi/g, "")
    // "41. Asliye" ile "41. Asliye Hukuk" aynı mahkeme; ceza ve ticaret ayrı kalır
    .replace(/\basliye hukuk\b/g, "asliye")
    .replace(/[^0-9a-zçğıöşü]/g, "");
}

/** Ekranda ve listede kullanılacak düzgün ad: "ANK. 9.SULH" → "Ankara 9. Sulh Hukuk Mahkemesi" */
export function prettyCourt(court: string | undefined, bias?: "ceza") {
  const e = expandCourt(court, bias);
  if (!e) return (court ?? "").trim();
  const kind = /(hukuk|ceza|sulh|aile|iş|idare|vergi|icra|tüketici|ticaret|çocuk|kadastro|asliye)/;
  const named = /(mahkemesi|hakimliği|masası|savcılığı|dairesi|\bbam\b)/;
  const full = kind.test(e) && !named.test(e) ? `${e} mahkemesi` : e;
  return full.split(" ").map(titleWord).join(" ");
}

/**
 * "2026/515 (2023/698)" → { main: "2026/515", previous: ["2023/698"] }.
 * "2025/56 ile birleştirildi. (2026/338)" → dosyanın kendi numarası parantezdeki 2026/338;
 * yazının tamamı remark olarak nota gider.
 */
export function parseEsas(raw: string | undefined) {
  const text = (raw ?? "").trim();
  const nums = text.match(/\d{4}\s*\/\s*\d+(?:\s*[a-zçğıöşü]\.)?/gi) ?? [];
  const clean = nums.map((n) => n.replace(/\s+/g, "").replace(/([a-zçğıöşü]\.)$/i, " $1"));
  // Numaradan başka yazı varsa (ör. "ile birleştirildi") açıklama olarak saklanır
  const remark = /[a-zçğıöşü]{3,}/i.test(text.replace(/\d{4}\s*\/\s*\d+/g, "")) ? text : undefined;
  if (remark && /birleş/i.test(remark) && clean.length > 1)
    return { main: clean[clean.length - 1], previous: [], remark };
  return { main: clean[0] ?? text, previous: clean.slice(1), remark };
}

/**
 * Kayıtlı dava dosyası (yeniden yüklemede güncellenir): mahkeme + esas no; esas no yoksa
 * aynı mahkemede esas nosu olmayan, aynı müvekkilin dosyası.
 */
export function findCaseByCourtEsas(
  state: ErpState,
  court: string,
  esas: string,
  clientName?: string,
) {
  const ck = courtKey(court);
  const key = fileNoKey(parseEsas(esas).main);
  if (!key) {
    if (!ck || !clientName) return undefined;
    const client = clientByName(state, clientName);
    return client
      ? state.cases.find(
          (c) => !c.esasNo && c.clientId === client.id && courtKey(c.court) === ck,
        )
      : undefined;
  }
  const same = state.cases.filter((c) => fileNoKey(c.esasNo ?? "") === key);
  return ck ? same.find((c) => courtKey(c.court) === ck) : same.length === 1 ? same[0] : undefined;
}

/** Mahkemeden dosya türü: İdare / Vergi → İdare, Ceza / Çocuk → Ceza, diğerleri Hukuk */
function caseTypeFromCourt(court: string, types: string[]) {
  // Kısaltmalar açılmış ad (ASCM → asliye ceza, İD → idare); CBS: başsavcılık (ilamat), infaz da ceza
  const c = expandCourt(court);
  const t = /idare|vergi/.test(c)
    ? "İdare"
    : /ceza|çocuk mah|infaz|\bcbs\b|savcılı/.test(c)
      ? "Ceza"
      : "Hukuk";
  return matchOption(t, types) ?? t;
}

/**
 * Listedeki durum yazısından dosya durumu: KAPALI 57 → Kapalı, İSTİNAFTA → İstinafta,
 * YARGITAYDA / TEMYİZDE → Temyizde, İSTİNAFTAN DÖNDÜ / DERDEST → Açık.
 */
export function caseStatusFrom(text: string): string | undefined {
  const t = norm(text);
  if (!t) return undefined;
  if (/açıkta/.test(t)) return "Açık";
  if (/istinaftan döndü|bozdu/.test(t)) return /yargıtay|temyiz/.test(t) ? "Temyizde" : "Açık";
  if (/yargıtay|temyiz/.test(t)) return "Temyizde";
  if (/istinaf/.test(t)) return "İstinafta";
  if (/kapal|işlemden kaldırıldı/.test(t)) return "Kapalı";
  if (/derdest|açık|birleştirme|değişik iş/.test(t)) return "Açık";
  return undefined;
}

/** "VEK. ÜCR. ALINDI" → "Vekalet ücreti alındı"; vekalet ücreti / CMK yazmıyorsa tanınmaz */
export function feeStatusFrom(text: string, options: string[]): string | undefined {
  const t = norm(text).replace(/\./g, " ").replace(/\s+/g, " ");
  if (!/vek|ücr|ucr|cmk/.test(t)) return undefined;
  const label = /cmk/.test(t)
    ? /alınacak|alinacak/.test(t)
      ? "CMK vekalet ücreti alınacak"
      : "CMK"
    : /icra/.test(t)
      ? "Vekalet ücreti icrada"
      : /alındı|alindi|ödendi/.test(t)
        ? "Vekalet ücreti alındı"
        : /istendi|talep edildi/.test(t)
          ? "Vekalet ücreti istendi"
          : /yok/.test(t)
            ? "Vekalet ücreti yok"
            : undefined;
  return label ? (matchOption(label, options) ?? label) : undefined;
}

type CaseResolved = {
  court?: string;
  esasNo?: string;
  type: string;
  status: string;
  clientName?: string;
  feeStatus?: string;
  note?: string;
};

/** Bir satırı dava dosyasına çevirir (yeni kayıt ve güncelleme aynı kuralla) */
function resolveCase(v: RowValues, ctx: ImportContext, warnings: string[] = []): CaseResolved {
  const s = ctx.state;
  // Ayarlardaki mahkeme aynı mahkemeyse onun yazımı kullanılır (liste kısaltma dolmasın)
  const rawCourt = v.court?.trim() || "";
  const parted = splitPreviousCourt(rawCourt);
  // CMK vekalet yazısı ceza listesindeki yalın "asliye"yi asliye ceza yapar
  const cmk = /\bcmk\b/.test(norm(`${v.feeStatus ?? ""} ${v.remark ?? ""}`));
  const bias = cmk ? ("ceza" as const) : undefined;
  // Aynı mahkemenin farklı yazımları tek ada iner: Ayarlar'da varsa o yazım, yoksa düzgün ad
  // ("ANK. 9.SULH" → "Ankara 9. Sulh Hukuk Mahkemesi"); yeniden yüklemede de aynı ad çıkar
  const court = parted.name
    ? (s.settings.courts.find((c) => courtKey(c) === courtKey(parted.name, bias)) ??
      prettyCourt(parted.name, bias))
    : undefined;
  const esas = parseEsas(v.esasNo);
  const fromCourt = court ? caseTypeFromCourt(court, s.settings.caseTypes) : undefined;
  const type =
    (v.type?.trim() && matchOption(v.type, s.settings.caseTypes)) ||
    (cmk && (!fromCourt || fromCourt === "Hukuk")
      ? (matchOption("Ceza", s.settings.caseTypes) ?? "Ceza")
      : fromCourt) ||
    s.settings.caseTypes[0];

  // Durum: "Durum" ve (varsa) başlıksız ikinci durum sütunu birlikte okunur
  // ("DERDEST" + "KAPALI 57" → Kapalı; DERDEST tek başına → Açık). Tanınmazsa listedeki
  // durumlardan biri (ör. "Karar") olduğu gibi alınır.
  const statusRaw = [v.status, v.statusDetail].map((x) => x?.trim()).filter(Boolean).join(" ");
  const status =
    caseStatusFrom(statusRaw) ||
    (v.status?.trim() && matchOption(v.status, s.settings.caseStatuses)) ||
    "Açık";
  if (statusRaw && !caseStatusFrom(statusRaw) && !matchOption(statusRaw, s.settings.caseStatuses))
    warnings.push(`Durum tanınmadı, "Açık" sayıldı: ${statusRaw}`);
  // Listedeki durumun ek bilgisi (ör. "KAPALI 57") notta kalır
  const extraStatus = (v.statusDetail?.trim() || v.status?.trim() || "").trim();
  const keepStatus =
    extraStatus && norm(extraStatus) !== norm(status) && norm(extraStatus) !== "derdest";

  // Müvekkil: ilk isim; aynı hücredeki diğer isimler nota
  const names = (v.client ?? "")
    .split(/\s*[,/;]\s*|\s+-\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const remark = v.remark?.trim() ?? "";
  const feeStatus =
    (v.feeStatus?.trim() && (matchOption(v.feeStatus, s.settings.caseFeeStatuses ?? []) ?? v.feeStatus.trim())) ||
    feeStatusFrom(remark, s.settings.caseFeeStatuses ?? []);

  const note = [
    v.note?.trim(),
    remark && !feeStatusFrom(remark, s.settings.caseFeeStatuses ?? []) && remark,
    keepStatus && `Listedeki durum: ${extraStatus}`,
    esas.remark && `Esas no notu: ${esas.remark}`,
    esas.previous.length && `Önceki esas no: ${esas.previous.join(", ")}`,
    parted.previous && `Önceki mahkeme: ${prettyCourt(parted.previous)}`,
    parted.label,
    names.length > 1 && `Diğer müvekkiller: ${names.slice(1).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    court,
    esasNo: esas.main || undefined,
    type,
    status,
    clientName: names[0],
    feeStatus: feeStatus || undefined,
    note: note || undefined,
  };
}

const cases: ImportSpec = {
  kind: "cases",
  title: "Dosyalar (hukuk / ceza / idare)",
  noun: "dosya",
  description:
    "Hukuk, ceza ve idare dosya listelerinizi yükleyin. Kayıtlı dosya (mahkeme + esas no) yeniden gelirse değişen bilgiler güncellenir.",
  allowed: (p) => p.can("cases", "create"),
  softDuplicates: false,
  updatable: true,
  columns: [
    {
      key: "court",
      header: "Mahkeme",
      type: "lookup",
      creatable: true,
      options: (c) => c.state.settings.courts,
      hint: "Listeden seçin veya yazın; yeni mahkeme listeye eklenir. İdare / ceza mahkemesi türü belirler",
      example: "Ankara 9. Sulh Hukuk Mahkemesi",
      width: 30,
      aliases: ["Mahkeme / merci", "Merci", "Birim"],
    },
    {
      key: "esasNo",
      header: "Esas no",
      hint: "Ör. 2026/515. Parantezdeki eski numaralar nota yazılır",
      example: "2026/515 (2023/698)",
      aliases: ["Esas", "Esas numarası"],
    },
    {
      key: "client",
      header: "Müvekkil",
      type: "lookup",
      options: lists.clients,
      hint: "Müvekkiller'de kayıtlı olmalı. Birden çok isim varsa ilki müvekkil, diğerleri nota",
      width: 26,
      aliases: ["Müvekkil adı", "Taraf"],
    },
    {
      key: "status",
      header: "Durum",
      type: "enum",
      creatable: true,
      options: (c) => c.state.settings.caseStatuses,
      hint: "Açık, Kapalı, İstinafta, Temyizde… KAPALI 57, YARGITAYDA gibi yazımlar da tanınır",
      example: "İstinafta",
      aliases: ["Dosya durumu"],
    },
    {
      key: "statusDetail",
      header: "Durum açıklaması",
      hint: "İkinci durum sütunu (ör. KAPALI 57); durumla birlikte okunur",
    },
    {
      key: "feeStatus",
      header: "Vekalet ücreti durumu",
      type: "enum",
      creatable: true,
      options: (c) => c.state.settings.caseFeeStatuses ?? [],
      hint: "Alındı, icrada, istendi, yok, CMK…",
      aliases: ["Ücret durumu"],
    },
    {
      key: "remark",
      header: "Açıklama",
      hint: "VEK. ÜCR. ALINDI gibi yazımlar vekalet ücreti durumuna, diğerleri nota",
      width: 28,
      aliases: ["Açıklamalar"],
    },
    {
      key: "type",
      header: "Dosya türü",
      type: "enum",
      options: (c) => c.state.settings.caseTypes,
      hint: "Boşsa mahkemeden: idare ve vergi → İdare, ceza veya CMK → Ceza, diğerleri → Hukuk",
      aliases: ["Tür"],
    },
    {
      key: "no",
      header: "Dosya no",
      hint: "Büro dosya numarası; boş bırakılırsa otomatik verilir",
      example: "2026/150",
      aliases: ["Büro dosya no"],
    },
    {
      key: "title",
      header: "Konu",
      hint: "Boşsa mahkeme adı yazılır",
      example: "Alacak davası",
      width: 26,
      aliases: ["Dosya konusu", "Dosya adı"],
    },
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
  // Büro listelerinde başlıksız sütunlar: sıra no, mahkeme, müvekkil, durum, açıklama
  guessColumn(samples, used) {
    const share = (re: RegExp) => samples.filter((x) => re.test(x)).length / samples.length;
    if (share(/^\d+([.,]0+)?$/) > 0.8) return undefined;
    if (!used.has("esasNo") && share(/\d{4}\s*\/\s*\d+/) > 0.6) return "esasNo";
    if (
      !used.has("court") &&
      share(/mahkeme|\bmah\b|asliye|sulh|ağır ceza|aile|idare|vergi|icra hukuk|tüketici|ticaret|çocuk|\bahm\b|\bshm\b|\bceza\b|\biş\b/i) > 0.6
    )
      return "court";
    if (share(/kapal|istinaf|yargıtay|temyiz|derdest|açık|birleştirme|bozdu|kaldırıldı/i) > 0.4)
      return !used.has("status") ? "status" : !used.has("statusDetail") ? "statusDetail" : undefined;
    if (!used.has("remark") && share(/vek|ücr|cmk|oluştur|dosya/i) > 0.4) return "remark";
    if (!used.has("client") && share(/^[^\d]{3,}$/) > 0.8) return "client";
    return undefined;
  },
  check(v, ctx) {
    const errors: Errors = {};
    const warnings: string[] = [];
    const r = resolveCase(v, ctx, warnings);
    if (!r.court && !r.esasNo && !v.title?.trim()) errors.court = "Mahkeme ve esas no girin";
    if (!r.esasNo && !r.clientName && !v.no?.trim())
      warnings.push("Esas no ve müvekkil yok: yeniden yüklemede tanınamaz, tekrar eklenir");
    // Müvekkil aktarımda açılmaz; önce Müvekkiller'den eklenir
    if (!r.clientName) warnings.push("Müvekkil yok");
    else if (!clientByName(ctx.state, r.clientName))
      errors.client = `Müvekkil kayıtlı değil: ${r.clientName}. Önce Müvekkiller'den ekleyin`;
    if (v.type?.trim()) enumOf(v, "type", ctx.state.settings.caseTypes, errors, r.type);
    date(v, "openingDate", errors);
    money(v, "agreedFee", errors);
    if (v.responsible?.trim()) {
      const u = findUsers(ctx.state, v.responsible);
      if (u.missing.length) errors.responsible = `Kullanıcı bulunamadı: ${u.missing.join(", ")}`;
    }
    // Kayıtlı dosya: mahkeme + esas no (ya da büro dosya no)
    const byCourt = findCaseByCourtEsas(ctx.state, r.court ?? "", r.esasNo ?? "", r.clientName);
    const no = norm(v.no).replace(/\s/g, "");
    const byNo = no ? ctx.state.cases.find((c) => norm(c.no).replace(/\s/g, "") === no) : undefined;
    const dup = byCourt ?? byNo;
    return {
      errors,
      warnings,
      existing: dup ? `Kayıtlı dosya: ${dup.no}${dup.esasNo ? ` · ${dup.esasNo}` : ""}` : undefined,
      // Esas no yoksa mahkeme + müvekkil (aynı dosya listede iki kez geçmesin)
      key: r.esasNo
        ? `${courtKey(r.court)}|${fileNoKey(r.esasNo)}`
        : no || (r.court && r.clientName ? `${courtKey(r.court)}|${norm(r.clientName)}` : undefined),
    };
  },
  build(rows, ctx) {
    const s = ctx.state;
    const auto = nextCaseNumbers(s.cases, rows.filter((v) => !v.no?.trim()).length);
    const clientId = (name?: string) => (name ? clientByName(s, name)?.id : undefined);
    const out: Draft<"cases">[] = rows.map((v) => {
      const r = resolveCase(v, ctx);
      return {
        no: v.no?.trim() || auto.shift()!,
        title: v.title?.trim() || r.court || r.esasNo || "Dosya",
        clientId: clientId(r.clientName),
        type: r.type,
        status: r.status as CaseFile["status"],
        court: r.court,
        esasNo: r.esasNo,
        opposingParty: opt(v.opposingParty),
        responsibleIds: v.responsible?.trim()
          ? findUsers(s, v.responsible).ids
          : ctx.user.role === "Avukat"
            ? [ctx.user.id]
            : [],
        openingDate: parseDateText(v.openingDate ?? "") ?? today(),
        agreedFee: parseAmount(v.agreedFee ?? "") || undefined,
        feeStatus: r.feeStatus,
        note: r.note,
      };
    });
    return { cases: out };
  },
  /**
   * Kayıtlı dosyada Excel'de değişen bilgiler: durum, vekalet ücreti durumu, karşı taraf; not
   * satırları eklenir (silinmez). Müvekkil yalnızca dosyada yoksa eklenir; büro no ve sorumlu değişmez.
   */
  planUpdate(v, ctx) {
    const r = resolveCase(v, ctx);
    const target =
      findCaseByCourtEsas(ctx.state, r.court ?? "", r.esasNo ?? "", r.clientName) ??
      (v.no?.trim()
        ? ctx.state.cases.find(
            (c) => norm(c.no).replace(/\s/g, "") === norm(v.no).replace(/\s/g, ""),
          )
        : undefined);
    if (!target) return null;
    const built = cases.build([v], ctx);
    const d = built.cases?.[0];
    if (!d) return null;
    const merged: CaseFile = { ...target };
    const changes: FieldChange[] = [];
    if ((v.status?.trim() || v.statusDetail?.trim()) && d.status !== target.status) {
      changes.push({ label: "Durum", from: target.status, to: d.status });
      merged.status = d.status;
    }
    if (d.feeStatus && d.feeStatus !== (target.feeStatus ?? "")) {
      changes.push({ label: "Vekalet ücreti", from: target.feeStatus || "—", to: d.feeStatus });
      merged.feeStatus = d.feeStatus;
    }
    if (v.type?.trim() && d.type !== target.type) {
      changes.push({ label: "Tür", from: target.type, to: d.type });
      merged.type = d.type;
    }
    if (d.opposingParty && d.opposingParty !== (target.opposingParty ?? "")) {
      changes.push({ label: "Karşı taraf", from: target.opposingParty || "—", to: d.opposingParty });
      merged.opposingParty = d.opposingParty;
    }
    if (!target.clientId && d.clientId) {
      const name = ctx.state.clients.find((c) => c.id === d.clientId)?.name ?? "";
      changes.push({ label: "Müvekkil eklenir", from: "", to: name });
      merged.clientId = d.clientId;
    }
    const note = mergeText(target.note ?? "", d.note ?? "");
    if (note !== (target.note ?? "")) {
      changes.push({
        label: "Not",
        from: target.note?.trim() ? "mevcut not korunur" : "—",
        to: target.note?.trim() ? "yeni satırlar eklenir" : note.replace(/\s+/g, " ").slice(0, 60),
      });
      merged.note = note;
    }
    return {
      changes,
      blocked: changes.length > 0 && !ctx.permissions.can("cases", "edit"),
      batch: { cases: [merged] },
    };
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

/* ───────────── Ajanda (duruşma listesi) ───────────── */

type ReminderResolved = {
  date: string;
  time?: string;
  type: string;
  title: string;
  caseId?: string;
  clientId?: string;
  assigneeId: string;
  note?: string;
  caseNo?: string;
  parties?: string;
};

/**
 * Ajanda satırı. UYAP "Duruşma Sorgulama" çıktısı doğrudan okunur: Birim, Dosya No, Dosya Türü,
 * Duruşma Tarihi (saatli), Taraf Bilgisi, İşlem, Sonuç. Taraflardan müvekkil listesindekiler
 * bulunur; başlıkta müvekkilin adı ve dosyadaki sıfatı (davacı, davalı, sanık…) görünür.
 */
function resolveReminder(
  v: RowValues,
  ctx: ImportContext,
  errors: Errors,
  warnings: string[] = [],
): ReminderResolved {
  const s = ctx.state;
  const types = s.settings.reminderTypes;
  const d = date(v, "date", errors, { required: true });

  // UYAP'ın "İşlem"i (Duruşma, Keşif, Ön İnceleme…) türlerde yoksa Duruşma sayılır, adı başlıkta kalır
  const activity = v.type?.trim() ?? "";
  const keşif = types.find((t) => norm(t) === "keşif");
  const type =
    (activity && matchOption(activity, types)) ||
    (keşif && /keşif/i.test(activity) ? keşif : undefined) ||
    (types.includes("Duruşma") ? "Duruşma" : types[0]);

  // Saat ayrı sütunda ya da tarih hücresinde ("02.11.2026 10:30") olabilir
  const rawTime = v.time?.trim() ?? "";
  let time = rawTime ? (parseTimeText(rawTime) ?? undefined) : undefined;
  if (rawTime && !time) errors.time = "Saat SS:DD biçiminde olmalı (ör. 10:30)";
  if (!rawTime && v.date?.trim()) time = parseTimeText(v.date) ?? undefined;

  // Dava dosyası: sistemde varsa bağlanır (UYAP'ta "2026/220", sistemde "2026/220 E." olabilir)
  const caseRaw = firstPart(v.case?.trim() ?? "");
  const court = v.location?.trim() ?? "";
  // UYAP "Dosya No" mahkemenin esas numarasıdır; kısaltmalı mahkeme adları da eşleşir
  const kase = caseRaw ? findCaseByCourtEsas(s, court, caseRaw) : undefined;

  // Müvekkil: Müvekkil sütunu > taraflardan eşleşen > bağlı dava dosyasının müvekkili
  const parties = parseUyapParties(v.parties ?? "");
  const ours = matchClients(parties, s.clients);
  const cl = v.client?.trim() ? findClient(s, v.client) : {};
  if (cl.error) warnings.push(`Müvekkil "${v.client?.trim()}" bulunamadı; bağlanmadan eklenir`);
  if (parties.length && !ours.length && !cl.client && !kase)
    warnings.push("Taraflarda müvekkil listesindeki kimse bulunamadı");
  // Listede olmayan sıfat: sonraki tarafın adı kaymış olabilir, büro hücreyi kontrol etsin
  const unknownRoles = [...new Set(parties.filter((p) => !p.known).map((p) => p.role))];
  if (unknownRoles.length)
    warnings.push(
      `Tanınmayan sıfat: ${unknownRoles.join(", ")}. Taraf Bilgisi'ni kontrol edin (ad ile sıfat arasında " - " olmalı)`,
    );
  const clientId = cl.client?.id ?? ours[0]?.client.id ?? kase?.clientId;

  let assigneeId = ctx.user.id;
  if (v.assignee?.trim()) {
    const u = findUsers(s, v.assignee);
    if (u.missing.length) errors.assignee = `Kullanıcı bulunamadı: ${u.missing.join(", ")}`;
    else if (u.ids[0]) assigneeId = u.ids[0];
  }

  const side = clientPartiesText(ours);
  const title =
    v.title?.trim() ||
    // Talimat dosyası keşif / ön inceleme gibi başlıkta belirtilir: "Talimat duruşması · 2026/220"
    [
      isTalimatFile(v.fileType) ? talimatActivity(activity || type) : activity || type,
      kase?.no ?? caseRaw,
      side,
    ]
      .filter(Boolean)
      .join(" · ");
  const note = [
    v.note?.trim(),
    v.fileType?.trim() && `Dosya türü: ${v.fileType.trim()}`,
    v.result?.trim() && `Sonuç: ${v.result.trim()}`,
    v.judgeLeave?.trim() && v.judgeLeave.trim() !== "-" && `İzinli hakim: ${v.judgeLeave.trim()}`,
    parties.length &&
      `Taraflar:\n${parties.map((p) => `- ${p.name} (${roleLabel(p.role)})`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    date: d,
    time,
    type,
    title,
    caseId: kase?.id,
    clientId,
    assigneeId,
    note: note || undefined,
    caseNo: kase?.no ?? (caseRaw || undefined),
    // Taraflardan eşleşen yoksa Müvekkil sütunundaki / dosyadaki müvekkil (sıfat bilinmeden)
    parties:
      side ||
      (clientId ? s.clients.find((c) => c.id === clientId)?.name : undefined) ||
      undefined,
  };
}

/**
 * Aynı duruşma: aynı gün, aynı mahkeme ve dosya no (saat değişmiş olabilir: UYAP listesi
 * yeniden yüklenince saati güncellenir).
 */
function findSameHearing(state: ErpState, date: string, location?: string, caseNo?: string) {
  if (!caseNo) return undefined;
  const ck = courtKey(location);
  const no = fileNoKey(caseNo);
  return state.reminders.find(
    (x) =>
      x.date === date &&
      x.status !== "İptal" &&
      courtKey(x.location) === ck &&
      (fileNoKey(x.caseNo ?? "") === no ||
        x.title.split("·").some((part) => fileNoKey(part) === no)),
  );
}

const reminders: ImportSpec = {
  kind: "reminders",
  title: "Ajanda (duruşma listesi)",
  noun: "ajanda kaydı",
  description:
    "UYAP Duruşma Sorgulama çıktısını olduğu gibi yükleyin; taraflardan müvekkilleriniz ve sıfatları bulunur.",
  allowed: (p) => p.can("reminders", "create"),
  softDuplicates: true,
  updatable: true,
  ignoreHeaders: ["Dosya Görüntüle", "Takvime Ekle", "Sık Kullanılanlar", "E-Duruşma Talebi"],
  columns: [
    {
      key: "date",
      header: "Tarih",
      required: true,
      type: "date",
      hint: "GG.AA.YYYY (saat de yazılabilir: 02.11.2026 10:30)",
      example: "02.11.2026",
      aliases: ["Duruşma tarihi", "Gün"],
    },
    {
      key: "time",
      header: "Saat",
      type: "time",
      hint: "SS:DD",
      example: "10:30",
      aliases: ["Duruşma saati"],
    },
    {
      key: "type",
      header: "Tür",
      type: "enum",
      options: (c) => c.state.settings.reminderTypes,
      creatable: true,
      hint: "Duruşma, Keşif… Listede olmayan (ör. Ön İnceleme) Duruşma olarak eklenir, adı başlıkta kalır",
      example: "Duruşma",
      aliases: ["Ajanda türü", "İşlem"],
    },
    {
      key: "case",
      header: "Dosya no",
      type: "lookup",
      options: lists.cases,
      creatable: true,
      hint: "Sistemdeki dava dosyası (yoksa dosya no başlığa yazılır)",
      example: "2026/101 E.",
      width: 28,
      aliases: ["Dosya", "Esas no", "Esas"],
    },
    {
      key: "location",
      header: "Mahkeme / Yer",
      hint: "Mahkeme, salon ya da adres",
      example: "İstanbul 3. Asliye Hukuk",
      width: 28,
      aliases: ["Birim", "Mahkeme", "Yer", "Salon", "Adres"],
    },
    {
      key: "parties",
      header: "Taraf Bilgisi",
      hint: "UYAP biçimi: AD SOYAD - DAVACI AD SOYAD - DAVALI … Müvekkilleriniz bulunur",
      example: "AYŞE DEMİR - DAVACI ALİ KAYA - DAVALI",
      width: 40,
      aliases: ["Taraflar", "Taraf"],
    },
    {
      key: "fileType",
      header: "Dosya Türü",
      hint: "Notta görünür",
      example: "Hukuk Dava Dosyası",
      aliases: ["Dosya Turu"],
    },
    { key: "result", header: "Sonuç", hint: "Notta görünür", example: "Günü Verildi" },
    { key: "judgeLeave", header: "İzinli Hakim", hint: "Notta görünür (“-” ise yazılmaz)" },
    {
      key: "title",
      header: "Başlık",
      hint: "Boşsa işlem, dosya no ve müvekkil (sıfatıyla) yazılır",
      example: "Ön inceleme duruşması",
      width: 28,
      aliases: ["Konu", "Açıklama"],
    },
    {
      key: "client",
      header: "Müvekkil",
      type: "lookup",
      options: lists.clients,
      creatable: true,
      hint: "Boşsa taraflardan ya da dava dosyasından bulunur",
      width: 24,
    },
    {
      key: "assignee",
      header: "Sorumlu avukat",
      type: "lookup",
      options: lists.lawyers,
      hint: "Boşsa aktaran kişi. Ekrandaki “Toplu uygula” ile bütün satırlara tek seferde atanabilir",
      aliases: ["Sorumlu", "Avukat"],
    },
    { key: "note", header: "Not", hint: "Serbest not", width: 28 },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const warnings: string[] = [];
    const r = resolveReminder(v, ctx, errors, warnings);
    if (!r.title.trim()) errors.title = "Başlık ya da dosya no girin";
    // Aynı gün ve saatte aynı başlık ya da aynı yer + dosya no: UYAP listesi yeniden yüklenince
    // (arada müvekkil eklenip başlık değişse de) duruşma ikinci kez eklenmez
    const caseNo = firstPart(v.case?.trim() ?? "");
    const dup =
      ctx.state.reminders.find(
        (x) =>
          x.date === r.date &&
          (x.time ?? "") === (r.time ?? "") &&
          x.status !== "İptal" &&
          norm(x.title) === norm(r.title),
      ) ?? findSameHearing(ctx.state, r.date, v.location, caseNo);
    return {
      errors,
      warnings,
      existing: dup ? "Bu duruşma ajandada kayıtlı" : undefined,
      key: [r.date, r.time ?? "", norm(v.location), caseNo ? norm(caseNo) : norm(r.title)].join("|"),
    };
  },
  build(rows, ctx) {
    const out: Draft<"reminders">[] = rows.map((v) => {
      const r = resolveReminder(v, ctx, {});
      return {
        title: r.title,
        type: r.type,
        date: r.date,
        time: r.time,
        location: opt(v.location),
        caseId: r.caseId,
        clientId: r.clientId,
        assigneeId: r.assigneeId,
        status: "Bekliyor",
        note: r.note,
        caseNo: r.caseNo,
        parties: r.parties,
      };
    });
    return { reminders: out };
  },
  /**
   * Kayıtlı duruşmada UYAP'ta değişenler: saat, işlem / başlık, müvekkil ve sıfatı, dosya bağlantısı;
   * not satırları eklenir. Katılacak avukat, mazeret ve durum (büronun girdiği) değişmez.
   */
  planUpdate(v, ctx) {
    const d = reminders.build([v], ctx).reminders?.[0];
    if (!d) return null;
    const caseNo = firstPart(v.case?.trim() ?? "");
    const target =
      findSameHearing(ctx.state, d.date, v.location, caseNo) ??
      ctx.state.reminders.find(
        (x) =>
          x.date === d.date &&
          (x.time ?? "") === (d.time ?? "") &&
          x.status !== "İptal" &&
          norm(x.title) === norm(d.title),
      );
    if (!target) return null;
    const merged: Reminder = { ...target };
    const changes: FieldChange[] = [];
    if (d.time && d.time !== (target.time ?? "")) {
      changes.push({ label: "Saat", from: target.time || "—", to: d.time });
      merged.time = d.time;
    }
    if (d.title !== target.title) {
      changes.push({ label: "Başlık", from: target.title, to: d.title });
      merged.title = d.title;
    }
    if (d.parties && d.parties !== (target.parties ?? "")) {
      changes.push({ label: "Müvekkil (sıfatı)", from: target.parties || "—", to: d.parties });
      merged.parties = d.parties;
    }
    if (d.caseNo && !target.caseNo) merged.caseNo = d.caseNo;
    if (d.caseId && !target.caseId) {
      changes.push({ label: "Dava dosyasına bağlanır", from: "", to: d.caseNo ?? "" });
      merged.caseId = d.caseId;
    }
    if (d.clientId && !target.clientId) merged.clientId = d.clientId;
    const note = mergeText(target.note ?? "", d.note ?? "");
    if (note !== (target.note ?? "")) {
      changes.push({ label: "Not", from: target.note?.trim() ? "korunur" : "—", to: "yeni satırlar eklenir" });
      merged.note = note;
    }
    return {
      changes,
      blocked: changes.length > 0 && !ctx.permissions.can("reminders", "edit"),
      batch: { reminders: [merged] },
    };
  },
};

/* ───────────── Borçlular ───────────── */

/* ───────────── Bankalar (haciz listesi) ───────────── */

const banks: ImportSpec = {
  kind: "banks",
  title: "Bankalar",
  noun: "banka",
  description: "89/1 haciz ihbarnamesinde seçilecek bankaları toplu ekleyin.",
  allowed: (p) => p.can("settings_categories", "create"),
  softDuplicates: true,
  columns: [
    {
      key: "name",
      header: "Banka adı",
      required: true,
      hint: "Haciz gönderilecek bankanın adı",
      example: "Ziraat Bankası",
      width: 32,
      aliases: ["Banka", "Ad", "İsim"],
    },
    {
      key: "status",
      header: "Durum",
      type: "enum",
      options: () => ["Aktif", "Pasif"],
      hint: "Aktif veya Pasif (boşsa Aktif)",
      example: "Aktif",
      aliases: ["Aktif", "Pasif"],
    },
  ],
  check(v, ctx) {
    const errors: Errors = {};
    const name = required(v, "name", errors);
    enumOf(v, "status", ["Aktif", "Pasif"] as const, errors, "Aktif");
    const dup = ctx.state.banks.find((b) => norm(b.name) === norm(name));
    return {
      errors,
      warnings: [],
      existing: dup ? `Kayıtlı banka: ${dup.name}` : undefined,
      key: norm(name),
    };
  },
  build(rows, ctx) {
    const out: Draft<"banks">[] = rows.map((v) => {
      const name = v.name.trim();
      const existing = ctx.state.banks.find((b) => norm(b.name) === norm(name));
      return {
        id: existing?.id,
        name,
        active: matchOption(v.status ?? "", ["Aktif", "Pasif"]) !== "Pasif",
      };
    });
    return { banks: out };
  },
};

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

/**
 * Hücredeki birden fazla adı ayırır: "1- A 2- B", "1) A 2) B", "A; B" ve satır sonları.
 * Numarasız tek ad olduğu gibi kalır.
 */
export function splitNames(value: string) {
  return value
    .split(/[;\n]|(?:^|\s)\d{1,2}\s*[-)]\s+/)
    .map((x) => x.replace(/^\s*\d{1,2}\s*[-)]\s*/, "").trim())
    .filter(Boolean);
}

function findDebtor(state: ErpState, name: string): Debtor | undefined {
  const k = norm(name);
  return (
    state.debtors.find((d) => d.identity && norm(d.identity) === k) ??
    state.debtors.find((d) => norm(d.name) === k)
  );
}

/** Addan kişi / şirket tahmini (A.Ş., Ltd. Şti., Tic. vb. → Kurumsal) */
export function guessKind(name: string): "Bireysel" | "Kurumsal" {
  return /\b(a\.?\s?ş\.?|ltd|şti|şirketi|tic\.?|san\.?|holding|koop|vakf|derne|belediye|bakanl|a\.s\.?|inc|gmbh)/i.test(
    name,
  )
    ? "Kurumsal"
    : "Bireysel";
}

/** Liste değerini esnek eşler: "İlamsız Takip" → "İlamsız", "kapali" → "Kapalı" */
function matchLoose(value: string, options: readonly string[]) {
  const exact = matchOption(value, options);
  if (exact) return exact;
  const k = headerKey(value);
  if (k.length < 3) return undefined;
  return options
    .filter((o) => {
      const ok = headerKey(o);
      return ok.length >= 3 && (k.startsWith(ok) || ok.startsWith(k));
    })
    .sort((a, b) => headerKey(b).length - headerKey(a).length)[0];
}

const firstDateIn = (text?: string) => {
  const m = text?.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  return m ? parseDateText(`${m[1]}.${m[2]}.${m[3]}`) : null;
};

/**
 * "Örnek No: 7", "Örnek 7", "7", "örnek no 4-5" → ayarlardaki takip şekli adı.
 * Önce olduğu gibi, sonra numarasıyla eşlenir; bulunamazsa undefined.
 */
export function matchProcedure(raw: string, names: string[]) {
  const v = raw.trim();
  if (!v) return undefined;
  const num = (x: string) =>
    x
      .toLocaleLowerCase("tr")
      .replace(/^\s*(örnek|ornek)\s*(no)?\b|[:.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const key = num(v);
  return (
    names.find((n) => num(n) === key) ??
    matchLoose(v, names) ??
    names.find((n) => num(n).split(" ")[0] === key)
  );
}

/** Dosya durumu hücresi: "Açık", "Açık (Durdurulmuş : Takibe İtiraz)", "Kapalı (İnfaz)" */
function statusCell(raw: string | undefined, s: ErpState) {
  if (!raw?.trim()) return { status: defaultStatus(s) as string | undefined };
  const p = parseEnforcementStatus(raw);
  return { ...p, status: matchLoose(p.status, s.settings.enforcementStatuses) };
}

const defaultStatus = (s: ErpState) =>
  s.settings.enforcementStatuses.includes(DEFAULT_ENFORCEMENT_STATUS)
    ? DEFAULT_ENFORCEMENT_STATUS
    : (s.settings.enforcementStatuses[0] ?? DEFAULT_ENFORCEMENT_STATUS);

/**
 * Alacaklı olduğumuz ve borçlu olduğumuz dosyalar aynı sütunlarla tutulur; yalnızca
 * "Alacaklı" / "Borçlu" sütunlarından hangisinin müvekkilimiz olduğu değişir.
 * Sütunlar başlığa göre tanındığı için sıranın önemi yoktur.
 */
function enforcementSpec(side: EnforcementSide): ImportSpec {
  const owed = side === "Borçlu";
  const partyWord = owed ? "alacaklı" : "borçlu";
  const clientColumn: ImportColumn = {
    key: "client",
    header: owed ? "Borçlu (müvekkil)" : "Alacaklı (müvekkil)",
    required: true,
    type: "lookup",
    options: lists.clients,
    hint: owed
      ? "Müvekkil adı (borçlu olan müvekkilimiz). Müvekkiller'de kayıtlı olmalı."
      : "Müvekkil adı veya TC / vergi no; Müvekkiller'de kayıtlı olmalı. Parantezdeki şirket / ilk isim müvekkil olur; şirket sayfasında üstten seçilir.",
    example: owed ? "Kaya Holding A.Ş." : "Mehmet Yılmaz",
    width: 26,
    aliases: owed
      ? ["Borçlu", "Borçlu müvekkil", "Müvekkil"]
      : ["Alacaklı", "Alacaklı müvekkil", "Müvekkil"],
  };
  const partiesColumn: ImportColumn = {
    key: "debtors",
    header: owed ? "Alacaklı (karşı taraf)" : "Borçlu",
    required: !owed,
    type: "multi",
    hint: owed
      ? `Birden fazlaysa "1- Ad 2- Ad" ya da ; ile yazın. Boş bırakılabilir.`
      : `Birden fazlaysa "1- Ad 2- Ad" ya da ; ile yazın. Kayıtlı değilse oluşturulur`,
    example: "1- Ali Veli 2- Ayşe Kaya",
    width: 30,
    aliases: owed ? ["Alacaklı", "Alacaklılar", "Karşı taraf"] : ["Borçlular", "Borçlu adı"],
  };
  return {
    kind: owed ? "enforcementsOwed" : "enforcements",
    // Büronun kendi Excel şablonu (İcra Boş Şablon.xlsx); borçlu listesinde Borçlu solda, Alacaklı sağda
    templateFile: owed
      ? { url: "/sablonlar/icra-borclu-bos-sablon.xlsx", filename: "İcra Borçlu Boş Şablon.xlsx" }
      : { url: "/sablonlar/icra-bos-sablon.xlsx", filename: "İcra Boş Şablon.xlsx" },
    title: owed ? "İcra – borçlu olduğumuz" : "İcra – alacaklı olduğumuz",
    noun: "icra dosyası",
    description: owed
      ? "Müvekkilimizin borçlu olduğu takipler. Büronun Excel listesi doğrudan yüklenebilir."
      : "Müvekkilimizin alacaklı olduğu takipler. Büronun Excel listesi doğrudan yüklenebilir.",
    allowed: (p) => p.can("enforcements", "create"),
    softDuplicates: false,
    updatable: true,
    columns: [
      {
        key: "status",
        header: "Dosya durumu",
        type: "lookup",
        creatable: true,
        options: (c) => [
          ...c.state.settings.enforcementStatuses,
          ...c.state.settings.enforcementStopReasons.map((r) => `Açık (Durdurulmuş : ${r})`),
          ...c.state.settings.enforcementCloseReasons.map((r) => `Kapalı (${r})`),
        ],
        hint: "Açık, Açık (Durdurulmuş : Takibe İtiraz), Kapalı (İnfaz)… (boşsa Açık)",
        width: 26,
        aliases: ["Durum"],
      },
      ...(owed ? [clientColumn, partiesColumn] : [clientColumn, partiesColumn]),
      {
        key: "office",
        header: "Birim",
        required: true,
        type: "lookup",
        creatable: true,
        options: (c) => c.state.settings.enforcementOffices,
        hint: "İcra dairesi; yeni yazılan listeye eklenir",
        example: "Ankara 5. Genel İcra Dairesi",
        width: 28,
        aliases: ["İcra dairesi", "Daire"],
      },
      {
        key: "no",
        header: "Dosya no",
        required: true,
        hint: "Ör. 2026/101 E. (aktarımda bu biçime getirilir)",
        example: "2026/101 E.",
        // "No" takma adı yok: şirket sayfalarındaki "No" (sıra no) sütunu gerçek Dosya No'yu gölgelemesin
        aliases: ["İcra dosya no", "Esas no", "Dosya No"],
      },
      {
        key: "type",
        header: "Takip türü",
        type: "lookup",
        creatable: true,
        options: (c) => c.state.settings.enforcementTypes,
        hint: 'İlamsız, İlamlı, Kambiyo… ("İlamsız Takip" de tanınır). Boş bırakılabilir.',
        aliases: ["Tür"],
      },
      {
        key: "procedure",
        header: "Takip şekli",
        type: "lookup",
        options: (c) => c.state.settings.procedures.map((p) => p.name),
        hint: 'Örnek No: 7 gibi; kesinleştirme / tahliye hatırlatması buna göre ("7" de tanınır)',
        example: "Örnek No: 7",
        width: 18,
        aliases: ["Örnek No", "Örnek", "Takip şekli (örnek no)"],
      },
      {
        key: "details",
        header: "Takip bilgileri",
        hint: "Dosyaya özgü serbest metin: alacağın niteliği, ilgili dosya…",
        example: "Kambiyo alacağı – çek",
        width: 32,
        multiline: true,
        aliases: ["Takip bilgisi", "Dosya bilgisi", "Dosya bilgileri"],
      },
      {
        key: "principal",
        header: "Takip çıkış rakamı",
        type: "money",
        hint: "Asıl alacak + faiz + masraf toplamı (boşsa 0; uyarı verilir)",
        example: "41786,30",
        aliases: [
          "Takip çıkış tutarı",
          "Asıl alacak",
          "Asıl",
          "Alacak",
          "Tutar",
          "Çıkış Rakamı",
          "Çıkış rakamı",
        ],
      },
      {
        key: "note",
        header: "Açıklamalar",
        hint: "İşlem geçmişi notları; satır sonları korunur",
        width: 40,
        multiline: true,
        aliases: ["Açıklama", "Not", "Notlar"],
      },
      {
        key: "lastSeizureDate",
        header: "Son haciz tarihi",
        type: "date",
        hint: "GG.AA.YYYY veya tarih listesi; en son tarih alınır, hücrenin tamamı nota eklenir",
        aliases: ["Haciz tarihi"],
        multiline: true,
      },
      {
        key: "stopReason",
        header: "Durdurulma sebebi",
        type: "lookup",
        creatable: true,
        options: (c) => c.state.settings.enforcementStopReasons,
        hint: "Durum Durdurulmuş ise",
        aliases: ["Durdurma sebebi"],
      },
      {
        key: "openingDate",
        header: "Takip tarihi",
        type: "date",
        hint: "GG.AA.YYYY veya GG.AA.YYYY SS:DD (boşsa açıklamadaki ilk tarih, o da yoksa bugün)",
        aliases: ["Açılış tarihi", "Tarih", "Dosya Açılış Tarihi", "Dosya açılış tarihi"],
      },
      {
        key: "interest",
        header: "Faiz",
        type: "money",
        hint: "Varsa takip çıkış rakamına eklenir",
      },
      {
        key: "costs",
        header: "Takip masrafı",
        type: "money",
        hint: "Varsa takip çıkış rakamına eklenir",
        aliases: ["Masraf"],
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
    ],
    check(v, ctx) {
      const errors: Errors = {};
      const warnings: string[] = [];
      const s = ctx.state;
      const company = ctx.companyClient?.trim() || "";
      const no = normalizeFileNo(required(v, "no", errors));
      const office = required(v, "office", errors);
      if (!v.type?.trim()) warnings.push("Takip türü boş");
      else if (!matchLoose(v.type, s.settings.enforcementTypes))
        warnings.push(`Takip türü listeye eklenecek: ${v.type.trim()}`);
      const st = statusCell(v.status, s);
      if (!st.status)
        errors.status = `Listeden seçin: ${s.settings.enforcementStatuses.slice(0, 6).join(", ")}…`;
      if (st.stopReason && !matchLoose(st.stopReason, s.settings.enforcementStopReasons))
        warnings.push(`Durdurulma sebebi listeye eklenecek: ${st.stopReason}`);
      if (st.closeReason && !matchLoose(st.closeReason, s.settings.enforcementCloseReasons))
        warnings.push(`Kapanış sebebi listeye eklenecek: ${st.closeReason}`);
      if (
        v.procedure?.trim() &&
        !matchProcedure(
          v.procedure,
          s.settings.procedures.map((p) => p.name),
        )
      )
        errors.procedure =
          "Takip şekli bulunamadı; Ayarlar → Kategoriler → Takip şekilleri'ne ekleyin";

      const rowOwed =
        owed ||
        (!!company &&
          nameMentions(v.debtors ?? "", company) &&
          !nameMentions(v.client ?? "", company));
      const parsed = parseClientCell(v.client ?? "", company || undefined);
      const clientRaw = rowOwed
        ? company || v.client?.trim() || ""
        : parsed.clientName || v.client?.trim() || "";

      let clientId: string | undefined;
      // Boş müvekkil için "Belirtilmedi" gibi yer tutucu kart açılmaz; kullanıcı doldurur
      if (!clientRaw && !company) {
        errors.client = owed ? "Müvekkil (borçlu) boş; adını yazın" : "Zorunlu alan";
      } else if (clientRaw) {
        // Müvekkil aktarımda açılmaz; önce Müvekkiller'den eklenir
        const r = findClient(s, clientRaw);
        clientId = r.client?.id;
        if (!r.client)
          errors.client = /birden fazla/.test(r.error ?? "")
            ? r.error!
            : `Müvekkil kayıtlı değil: ${clientRaw}. Önce Müvekkiller'den ekleyin`;
      }

      const partyCell = rowOwed && company ? (v.client ?? "") : (v.debtors ?? "");
      if (!owed && !company && !required(v, "debtors", errors, `En az bir ${partyWord} girin`)) {
        /* required already recorded */
      } else if (partyCell.trim()) {
        const fresh = splitNames(partyCell).filter((n) => !findDebtor(s, n));
        if (fresh.length) warnings.push(`Yeni kart oluşturulacak: ${fresh.join(", ")}`);
      } else if (!owed) {
        /* alacaklı aktarımında şirket seçiliyse borçlu yine zorunlu */
        if (!company) {
          /* already handled */
        } else if (!(v.debtors ?? "").trim()) {
          errors.debtors = `En az bir ${partyWord} girin`;
        }
      }

      if (company && rowOwed) warnings.push(`Taraf: borçlu olduğumuz (${company})`);
      if (parsed.noteExtra) warnings.push("Rol / diğer alacaklı bilgisi nota eklenecek");

      money(v, "principal", errors);
      money(v, "interest", errors);
      money(v, "costs", errors);
      if (!errors.principal && !(v.principal ?? "").trim()) warnings.push("Tutar girilmemiş");

      date(v, "openingDate", errors);
      const seizureRaw = v.lastSeizureDate?.trim() ?? "";
      if (seizureRaw) {
        if (!parseDateText(seizureRaw) && !latestDateIn(seizureRaw))
          errors.lastSeizureDate = "Tarih GG.AA.YYYY biçiminde olmalı";
        else if (!parseDateText(seizureRaw) && latestDateIn(seizureRaw))
          warnings.push(
            "Son haciz: listedeki en son tarih alınacak; hücrenin tamamı nota eklenecek",
          );
      }
      if ((rowOwed || owed) && seizureRaw)
        warnings.push("Borçlu olduğumuz dosyada son haciz tarihi hatırlatma üretmez");
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
        (e) => fileNoKey(e.no) === fileNoKey(no) && norm(e.office) === norm(office),
      );
      return {
        errors,
        warnings,
        existing: dup ? `Bu icra dosyası zaten kayıtlı: ${dup.no}` : undefined,
        key: `${fileNoKey(no)}|${norm(office)}`,
      };
    },
    build(rows, ctx) {
      const s = ctx.state;
      const company = ctx.companyClient?.trim() || "";
      // Kayıtlı olmayan müvekkilli satır check'te hatalıdır, buraya gelmez
      const clientId = (value: string) => findClient(s, value).client?.id ?? "";
      const newParties = new Map<string, Draft<"debtors"> & { id: string }>();
      const partyId = (name: string) => {
        const existing = findDebtor(s, name);
        if (existing) return existing.id;
        const k = norm(name);
        if (!newParties.has(k))
          newParties.set(k, { id: newId(), name: name.trim(), kind: guessKind(name) });
        return newParties.get(k)!.id;
      };
      const out: Draft<"enforcements">[] = rows.map((v) => {
        const st = statusCell(v.status, s);
        const status = st.status ?? defaultStatus(s);
        const stopReason =
          status === STOPPED_ENFORCEMENT_STATUS
            ? (st.stopReason
                ? (matchLoose(st.stopReason, s.settings.enforcementStopReasons) ?? st.stopReason)
                : v.stopReason?.trim()) || ""
            : "";
        const closeReason =
          status === CLOSED_ENFORCEMENT_STATUS && st.closeReason
            ? (matchLoose(st.closeReason, s.settings.enforcementCloseReasons) ?? st.closeReason)
            : "";
        const type = v.type?.trim()
          ? (matchLoose(v.type, s.settings.enforcementTypes) ?? v.type.trim())
          : "";
        const rowOwed =
          owed ||
          (!!company &&
            nameMentions(v.debtors ?? "", company) &&
            !nameMentions(v.client ?? "", company));
        const parsed = parseClientCell(v.client ?? "", company || undefined);
        const clientName = rowOwed
          ? company || v.client?.trim() || ""
          : parsed.clientName || v.client?.trim() || company;
        const partyNames = splitNames(rowOwed && company ? (v.client ?? "") : (v.debtors ?? ""));
        const seizureRaw = v.lastSeizureDate?.trim() ?? "";
        const seizureIso = parseDateText(seizureRaw) ?? latestDateIn(seizureRaw) ?? "";
        const noteBits = [v.note?.trim() || "", parsed.noteExtra];
        if (seizureRaw && seizureRaw !== formatDate(seizureIso) && latestDateIn(seizureRaw))
          noteBits.push(`Son haciz notu:\n${seizureRaw}`);
        if (parsed.raw && company && !rowOwed && norm(parsed.raw) !== norm(company))
          noteBits.push(`Alacaklı hücresi: ${parsed.raw}`);
        const note = noteBits.filter(Boolean).join("\n\n");
        return {
          side: (rowOwed ? "Borçlu" : "Alacaklı") as EnforcementSide,
          no: normalizeFileNo(v.no),
          office: v.office.replace(/\s+/g, " ").trim(),
          type,
          clientId: clientId(clientName),
          debtorIds: [...new Set(partyNames.map(partyId))],
          principal: round2(
            (parseAmount(v.principal) ?? 0) +
              (parseAmount(v.interest ?? "") ?? 0) +
              (parseAmount(v.costs ?? "") ?? 0),
          ),
          interest: 0,
          costs: 0,
          status,
          stopReason,
          closeReason,
          procedure:
            matchProcedure(
              v.procedure ?? "",
              s.settings.procedures.map((p) => p.name),
            ) ?? "",
          openingDate:
            parseDateText(v.openingDate ?? "") ??
            firstDateIn(note) ??
            firstDateIn(v.details) ??
            today(),
          lastSeizureDate: rowOwed ? "" : seizureIso,
          responsibleIds: v.responsible?.trim()
            ? findUsers(s, v.responsible).ids
            : ctx.user.role === "Avukat"
              ? [ctx.user.id]
              : [],
          caseId: v.case?.trim() ? findCase(s, v.case).kase?.id : undefined,
          details: v.details?.trim() || "",
          note,
        };
      });
      // Sıra önemli: önce karşı taraflar, sonra onlara bağlı dosyalar
      return { debtors: [...newParties.values()], enforcements: out };
    },
  };
}

const enforcements = enforcementSpec("Alacaklı");
const enforcementsOwed = enforcementSpec("Borçlu");

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  clients,
  cases,
  expenses,
  reminders,
  debtors,
  banks,
  enforcements,
  enforcementsOwed,
};

export const IMPORT_ORDER: ImportKind[] = [
  "clients",
  "cases",
  "expenses",
  "reminders",
  "debtors",
  "banks",
  "enforcements",
  "enforcementsOwed",
];
