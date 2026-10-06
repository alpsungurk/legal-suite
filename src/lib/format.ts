import type { ISODate } from "@/lib/erp-types";

/* ───────────── Para ───────────── */

const moneyFmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const compactFmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Kuruş hassasiyetinde yuvarlar (kayan nokta hatalarını önler). */
export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]) {
  return round2(values.reduce((acc, v) => acc + v, 0));
}

export function sumBy<T>(items: T[], pick: (item: T) => number) {
  return sum(items.map(pick));
}

export function formatMoney(n: number) {
  return moneyFmt.format(round2(n));
}

export function formatMoneyCompact(n: number) {
  return Math.abs(n) < 10_000 ? formatMoney(n) : compactFmt.format(n);
}

/** "12.500,50" / "12500.5" / "₺12.500" gibi girdileri sayıya çevirir. */
export function parseMoney(input: string | number | undefined | null): number {
  if (typeof input === "number") return Number.isFinite(input) ? round2(input) : 0;
  if (!input) return 0;
  let s = String(input).replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replaceAll(".", "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replaceAll(".", "");
  else if (/\.\d{3}$/.test(s)) s = s.replace(".", "");
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Eşit taksitlere böler, kuruş farkını son taksite ekler. */
export function splitAmount(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total / count) * 100) / 100;
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] = round2(total - base * (count - 1));
  return parts;
}

/* ───────────── Tarih ───────────── */

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Ay ekler; 31 Ocak + 1 ay = 28/29 Şubat gibi ay sonunu korur. */
export function addMonths(s: ISODate, months: number): ISODate {
  const d = parseISODate(s);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}

/** b - a gün farkı */
export function daysBetween(a: ISODate, b: ISODate) {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function daysFromToday(s: ISODate) {
  return daysBetween(today(), s);
}

export const MONTHS_SHORT = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];
export const MONTHS_LONG = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
export const WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function formatDate(s?: ISODate | null) {
  if (!s) return "—";
  const d = parseISODate(s.slice(0, 10));
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatDateLong(s?: ISODate | null) {
  if (!s) return "—";
  const d = parseISODate(s.slice(0, 10));
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatPeriod(period: string) {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
}

export function monthKey(s: ISODate) {
  return s.slice(0, 7);
}

/** "3 gün sonra", "Bugün", "2 gün gecikti" */
export function relativeDue(s: ISODate) {
  const diff = daysFromToday(s);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff === -1) return "Dün";
  if (diff < 0) return `${-diff} gün geçti`;
  return `${diff} gün sonra`;
}

export function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "Az önce";
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  if (d === 1) return "Dün";
  if (d < 30) return `${d} gün önce`;
  return formatDate(iso.slice(0, 10));
}

/* ───────────── Metin ───────────── */

export function initials(name: string) {
  return name
    .replace(/^Av\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr");
}

export function normalize(s: string) {
  return s.toLocaleLowerCase("tr").normalize("NFKD");
}

export function matches(query: string, ...fields: Array<string | number | undefined | null>) {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some((f) => f != null && normalize(String(f)).includes(q));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatIban(iban?: string) {
  if (!iban) return "";
  return iban
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
