/**
 * Çok sayfalı icra Excel'i: her sayfanın rolü (alacaklı / borçlu / şirket) belirlenir, bütün sayfalar
 * doğrulanıp tek pakette aktarılır. Sayfalar arası tekrar ve ortak müvekkil kartları burada çözülür.
 */
import type { ImportBatch } from "@/lib/erp-store";
import type { CompanyList, ErpState, Permissions, User } from "@/lib/erp-types";
import { DEFAULT_LIST_ICON } from "@/lib/list-icons";
import { newId } from "@/lib/mappers";
import { readSpreadsheet, type Workbook } from "@/lib/excel-read";
import { ingest, type Row } from "@/lib/import-ingest";
import { headerKey, IMPORT_SPECS, norm, type ImportContext } from "@/lib/import-specs";
import {
  buildWithUpdates,
  changeText,
  planEnforcementUpdate,
  withNewCards,
} from "@/lib/import-update";

export type SheetRole = "alacakli" | "borclu" | "sirket" | "atla";

export const SHEET_ROLE_LABEL: Record<SheetRole, string> = {
  alacakli: "Alacaklı olduğumuz",
  borclu: "Borçlu olduğumuz",
  sirket: "Şirket sayfası",
  atla: "Aktarma",
};

export type SheetPlan = {
  name: string;
  role: SheetRole;
  /** Şirket sayfasının müvekkili (sayfa adından ya da satırlardan çözülür, kullanıcı değiştirebilir) */
  company?: string;
  /** Kullanıcı seçimi gerekiyor: sayfa türü tanınmadı ya da şirket bulunamadı. Seçilene kadar aktarılmaz */
  pending?: string;
  /** Sayfa türü hiç tanınmadı (yalnızca şirket değil, tür de seçilmeli) */
  needsRole?: boolean;
  /** Şirket seçimi için öneriler: sayfadaki en sık geçen tek isimler */
  candidates?: string[];
  rows: Row[];
  /** Aktarılmayan sayfanın nedeni */
  reason?: string;
  /** Tanınmayan sütunlar ve dolu hücre sayıları (içerik dosya notuna eklenir) */
  unknownFilled?: Record<string, number>;
  /** Sayfadaki dolu satır sayısı ile okunan satır sayısı aynı olmalı */
  dataRows?: number;
  truncated?: boolean;
  /** Aktarılmayan sayfanın içeriği (hücreler " | " ile birleşik satırlar); indirilebilir */
  raw?: string[];
};

export type RejectedRow = {
  sheet: string;
  line: number;
  reason: string;
  values: Row["values"];
};

export type SheetResult = {
  plan: SheetPlan;
  total: number;
  /** Yeni eklenecek */
  ok: number;
  /** Kayıtlı ve Excel'de değişen bilgi var: güncellenecek */
  update: number;
  /** Kayıtlı, değişiklik yok */
  existing: number;
  error: number;
  /** Güncellenecek dosyalardan ilk birkaçı: "satır 12 · 2026/101 E.: Durum: Açık → Kapalı (İnfaz)" */
  changes: string[];
  /** İlk birkaç sorun: "satır 12: Tutar girin" */
  problems: string[];
  /** Aktarılacak dosyaların taraf dağılımı */
  alacakli: number;
  borclu: number;
  batch: ImportBatch;
  /** Aktarılmayacak satırlar (hatalı, tekrar, zaten kayıtlı) ve nedenleri */
  rejected: RejectedRow[];
};

const MAX_PROBLEMS = 4;
const UNKNOWN_SHEET = "Sayfa adı tanınmadı; bu sayfanın türünü seçin";
const PICK_COMPANY = "Bu şirket sayfasının hangi müvekkile ait olduğunu seçin";

/** Sayfa adından tür. Tanınmayan ad "şirket" sayılır ama şirket bulunamazsa kullanıcıya sorulur. */
function roleOf(name: string): { role: SheetRole; reason?: string; info?: boolean } {
  const k = headerKey(name);
  if (/^(aciklama|listeler|bilgi|yardim)/.test(k))
    return { role: "atla", reason: "Bilgi sayfası", info: true };
  if (k.includes("maas") && /hacz|haciz/.test(k))
    return {
      role: "atla",
      reason: "Maaş haczi sırası aktarılmaz; İcra → Maaş haczi sıraları ekranından girilir",
    };
  if (k.includes("borclu") && k.includes("oldugumuz")) return { role: "borclu" };
  if (k.includes("alacakli") && k.includes("oldugumuz")) return { role: "alacakli" };
  return { role: "sirket" };
}

export async function planWorkbook(
  file: File,
  state: ErpState,
): Promise<{ wb: Workbook; plans: SheetPlan[] }> {
  const wb = await readSpreadsheet(file);
  return { wb, plans: await planSheets(wb, state) };
}

/** Atlanan sayfanın hücrelerini satır satır metne çevirir; bilgi kaybolmasın diye indirilebilir */
function rawLines(wb: Workbook, name: string): string[] {
  const sheet = wb.sheets.find((x) => x.name === name);
  return (sheet?.rows ?? [])
    .map((r) =>
      r
        .map((c) => (c == null ? "" : String(c).trim()))
        .filter(Boolean)
        .join(" | "),
    )
    .filter(Boolean);
}

/** Dosyadaki bütün sayfaları sınıflandırıp satırlarına çevirir. */
export async function planSheets(wb: Workbook, state: ErpState): Promise<SheetPlan[]> {
  const plans: SheetPlan[] = [];
  for (const sheet of wb.sheets) {
    const { role, reason, info } = roleOf(sheet.name);
    if (info) {
      plans.push({ name: sheet.name, role: "atla", rows: [], reason, raw: [] });
      continue;
    }
    plans.push(await planSheet(wb, sheet.name, role, state, undefined, reason));
  }
  return plans;
}

/**
 * Tek sayfayı verilen türe göre okur. Kullanıcı özet ekranında türü ya da şirketi değiştirince de
 * çağrılır (borçlu sayfasında sütunlar farklı okunduğu için yeniden okumak gerekir).
 */
export async function planSheet(
  wb: Workbook,
  name: string,
  role: SheetRole,
  state: ErpState,
  company?: string,
  reason?: string,
): Promise<SheetPlan> {
  const skip = (why: string, rows: Row[] = []): SheetPlan => ({
    name,
    role: "atla",
    rows,
    reason: why,
    raw: rawLines(wb, name),
  });
  try {
    // Sütunlar sayfanın şablonuna göre okunur: borçlu sayfasında "Borçlu" müvekkil, "Alacaklı" karşı taraftır
    const spec = role === "borclu" ? IMPORT_SPECS.enforcementsOwed : IMPORT_SPECS.enforcements;
    const { rows, info } = await ingest(wb, spec, name);
    if (!rows.length) return { ...skip("Sayfada satır yok"), raw: [] };
    const base = {
      name,
      rows,
      unknownFilled: info.unknownFilled,
      dataRows: info.dataRows,
      truncated: info.truncated,
      candidates: companyCandidates(rows),
    };
    // Adından "aktarılmaz" sayılan ama satırları okunabilen sayfa (ör. maaş haczi): türü değiştirilebilir
    if (role === "atla") return { ...base, role, reason, raw: rawLines(wb, name) };
    if (role !== "sirket") return { ...base, role };
    const resolved = company?.trim() || resolveCompany(name, rows, state);
    if (resolved) return { ...base, role, company: resolved };
    // Sayfa adı ne bir listeye ne bir müvekkile benziyor: tahmin edilmez, sorulur
    return {
      ...base,
      role,
      pending: company === undefined ? UNKNOWN_SHEET : PICK_COMPANY,
      needsRole: company === undefined,
    };
  } catch (e) {
    return skip(`Okunamadı: ${(e as Error).message.replace(/^"[^"]*" sayfasında /, "")}`);
  }
}

/** Tek ad olan hücreler (parantezli ya da "1- A 2- B" biçimli olanlar aday değil) */
function singleName(cell?: string) {
  const v = (cell ?? "").replace(/\s+/g, " ").trim();
  return !v || v.startsWith("(") || /^\d+\s*-/.test(v) ? "" : v;
}

/** Şirket seçimi için öneri: sayfada en sık geçen tek isimler */
function companyCandidates(rows: Row[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rows)
    for (const cell of [r.values.client, r.values.debtors]) {
      const v = singleName(cell);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([v]) => v);
}

/**
 * Sayfa adından şirketin tam unvanı: adı içeren kayıtlı müvekkil, yoksa sayfada adı içeren en sık isim.
 * Kanıt yoksa undefined döner (sayfa adı müvekkil adı diye uydurulmaz).
 */
export function resolveCompany(
  sheetName: string,
  rows: Row[],
  state: ErpState,
): string | undefined {
  const t = norm(sheetName);
  if (t.length < 3) return undefined;
  const registered = state.clients.filter((c) => norm(c.name).includes(t));
  if (registered.length === 1) return registered[0].name;
  const counts = new Map<string, number>();
  for (const r of rows)
    for (const cell of [r.values.client, r.values.debtors]) {
      const v = singleName(cell);
      if (v && norm(v).includes(t)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? registered[0]?.name;
}

/** Her sayfayı doğrular ve oluşturulacak / güncellenecek kayıtları üretir. */
export function evaluatePlans(
  plans: SheetPlan[],
  state: ErpState,
  user: User,
  permissions: Permissions,
): SheetResult[] {
  const seen = new Map<string, string>();
  // Önceki sayfalarda oluşan müvekkil / karşı taraf kartları sonrakilerde "kayıtlı" sayılır
  let working = state;
  const results: SheetResult[] = new Array(plans.length);
  // Aynı dosya iki sayfada varsa dolu olan kazansın: borçlu sayfası (çoğu kez eksik satırlar) en sona kalır
  const rank: Record<SheetRole, number> = { alacakli: 0, sirket: 1, borclu: 2, atla: 3 };
  const order = plans
    .map((_, i) => i)
    .sort((a, b) => rank[plans[a].role] - rank[plans[b].role] || a - b);
  for (const index of order) {
    const plan = plans[index];
    const result: SheetResult = {
      plan,
      total: plan.rows.length,
      ok: 0,
      update: 0,
      existing: 0,
      error: 0,
      problems: [],
      changes: [],
      alacakli: 0,
      borclu: 0,
      batch: {},
      rejected: [],
    };
    results[index] = result;
    if (plan.role === "atla") continue;
    if (plan.pending) {
      result.problems.push(plan.pending);
      continue;
    }

    const spec = plan.role === "borclu" ? IMPORT_SPECS.enforcementsOwed : IMPORT_SPECS.enforcements;
    const ctx: ImportContext = {
      state: working,
      user,
      permissions,
      companyClient: plan.role === "sirket" ? plan.company : undefined,
    };
    const fresh: Row["values"][] = [];
    const known: Row[] = [];
    for (const row of plan.rows) {
      const check = spec.check(row.values, ctx);
      const messages = Object.entries(check.errors).map(([, m]) => m);
      const first = check.key ? seen.get(check.key) : undefined;
      if (messages.length || first) {
        const reason = first
          ? first === plan.name
            ? "Dosyada tekrar ediyor"
            : `"${first}" sayfasında da var`
          : messages.join(" · ");
        result.error++;
        result.rejected.push({ sheet: plan.name, line: row.line, reason, values: row.values });
        if (result.problems.length < MAX_PROBLEMS)
          result.problems.push(`satır ${row.line}: ${first ? reason : messages[0]}`);
        continue;
      }
      if (check.key) seen.set(check.key, plan.name);
      if (check.existing) known.push(row);
      else fresh.push(row.values);
    }

    // Yeni satırlar önce kurulur; güncellemeler onların açtığı kartları yeniden açmaz
    const built = buildWithUpdates(spec, fresh, [], ctx);
    let batch = built.batch;
    working = built.state;
    for (const row of known) {
      const up = planEnforcementUpdate(spec, row.values, { ...ctx, state: working });
      if (!up?.changes.length) {
        result.existing++;
        continue;
      }
      if (up.blocked) {
        result.existing++;
        result.rejected.push({
          sheet: plan.name,
          line: row.line,
          reason: `Güncelleme yetkiniz yok: ${up.changes.map(changeText).join(" · ")}`,
          values: row.values,
        });
        continue;
      }
      result.update++;
      batch = {
        ...batch,
        enforcements: [...(batch.enforcements ?? []), up.merged],
        debtors: [...(batch.debtors ?? []), ...up.debtors],
      };
      if (up.debtors.length) working = withNewCards(working, { debtors: up.debtors });
      if (result.changes.length < MAX_PROBLEMS)
        result.changes.push(
          `satır ${row.line} · ${up.target.no}: ${up.changes.map(changeText).join(" · ")}`,
        );
    }
    result.ok = fresh.length;
    result.batch = batch;
    for (const e of (batch.enforcements ?? []).slice(0, fresh.length)) {
      if (e.side === "Borçlu") result.borclu++;
      else result.alacakli++;
    }
  }
  return results;
}

/** Sayfa sonuçlarını tek aktarım paketinde birleştirir. */
export function mergeBatches(results: SheetResult[]): ImportBatch {
  const out: ImportBatch = { clients: [], debtors: [], enforcements: [] };
  for (const r of results) {
    out.clients!.push(...(r.batch.clients ?? []));
    out.debtors!.push(...(r.batch.debtors ?? []));
    out.enforcements!.push(...(r.batch.enforcements ?? []));
  }
  return out;
}

/**
 * Şirketler Ayarlar → Şirket listeleri'ne eklenir: aynı adlı liste varsa şirket ona eklenir, yoksa
 * verilen adla yeni liste açılır. Şirket zaten bir listedeyse dokunulmaz.
 */
export function companyListsFor(
  entries: Array<{ company: string; listName: string }>,
  batch: ImportBatch,
  state: ErpState,
  can: { create: boolean; edit: boolean },
): { lists: CompanyList[]; added: string[] } | null {
  let lists = state.settings.companyLists;
  const added: string[] = [];
  for (const { company, listName } of entries) {
    const key = norm(company);
    const client =
      (batch.clients ?? []).find((c) => norm(c.name) === key) ??
      state.clients.find((c) => norm(c.name) === key);
    const id = client?.id;
    if (!id || lists.some((l) => l.clientIds.includes(id))) continue;
    const name = listName.trim() || company.trim();
    const same = lists.find((l) => norm(l.name) === norm(name));
    if (same && can.edit) {
      lists = lists.map((l) => (l === same ? { ...l, clientIds: [...l.clientIds, id] } : l));
      added.push(name);
    } else if (!same && can.create) {
      lists = [...lists, { id: newId(), name, clientIds: [id], icon: DEFAULT_LIST_ICON }];
      added.push(name);
    }
  }
  return added.length ? { lists, added } : null;
}

/** Çok sayfalı aktarımda şirket sayfaları kendi adlarıyla listelenir */
export function companyListsAfterImport(
  results: SheetResult[],
  batch: ImportBatch,
  state: ErpState,
  can: { create: boolean; edit: boolean },
) {
  const entries = results
    .filter((r) => r.plan.role === "sirket" && r.plan.company && !r.plan.pending)
    .map((r) => ({ company: r.plan.company!, listName: r.plan.name }));
  return companyListsFor(entries, batch, state, can);
}
