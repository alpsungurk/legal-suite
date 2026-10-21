/**
 * Güncellenmiş icra Excel'i tekrar yüklenince kayıtlı dosyalar (dosya no + birim eşleşir) güncellenir.
 *
 * Kurallar (uygulamada girilen bilgi kaybolmasın diye):
 * - Excel'de boş olan hücre kayıttaki değeri silmez.
 * - Açıklamalar ve takip bilgileri ezilmez: Excel'de olup kayıtta olmayan satırlar sona eklenir.
 * - Son haciz tarihi yalnızca ileri alınır (uygulamada girilen daha yeni haciz korunur).
 * - Borçlular / karşı taraflar yalnızca eklenir, çıkarılmaz.
 * - Müvekkil, açılış tarihi, sorumlu avukat ve işlem geçmişi değişmez.
 */
import type { Draft, ImportBatch } from "@/lib/erp-store";
import {
  enforcementStatusLabel,
  type Client,
  type Debtor,
  type EnforcementFile,
  type ErpState,
} from "@/lib/erp-types";
import { fileNoKey, formatDate, formatMoney, round2 } from "@/lib/format";
import { norm, type ImportContext, type ImportSpec, type RowValues } from "@/lib/import-specs";

export type FieldChange = { label: string; from: string; to: string };

export type UpdatePlan = {
  target: EnforcementFile;
  merged: EnforcementFile;
  changes: FieldChange[];
  /** Excel'de yeni geçen borçlu / karşı taraf kartları */
  debtors: Array<Draft<"debtors"> & { id: string }>;
  /** Değişiklik var ama kullanıcının icra düzenleme yetkisi yok: güncellenmez */
  blocked: boolean;
};

/** Dosya no (eksiz) + birim ile kayıtlı icra dosyası */
export function findExistingEnforcement(state: ErpState, no: string, office: string) {
  const key = fileNoKey(no);
  const o = norm(office);
  return state.enforcements.find((e) => fileNoKey(e.no) === key && norm(e.office) === o);
}

const lineKey = (l: string) => l.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");

/** Kayıttaki metin korunur; Excel'de olup kayıtta olmayan satırlar sona eklenir */
export function mergeText(current = "", incoming = ""): string {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming;
  const have = new Set(current.split("\n").map(lineKey).filter(Boolean));
  const add = incoming.split("\n").filter((l) => lineKey(l) && !have.has(lineKey(l)));
  return add.length ? `${current.trimEnd()}\n${add.join("\n")}` : current;
}

const short = (s: string, n = 60) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t || "—";
};

/**
 * Satırın kayıtlı dosyada neyi değiştireceği. Kayıtlı değilse null.
 * Satır, yeni kayıtlarla aynı kurallarla (spec.build) çözülür; sonuç kayıtla karşılaştırılır.
 */
export function planEnforcementUpdate(
  spec: ImportSpec,
  v: RowValues,
  ctx: ImportContext,
): UpdatePlan | null {
  const target = findExistingEnforcement(ctx.state, v.no ?? "", v.office ?? "");
  if (!target) return null;
  const built = spec.build([v], ctx);
  const d = built.enforcements?.[0];
  if (!d) return null;

  const merged: EnforcementFile = { ...target, debtorIds: [...(target.debtorIds ?? [])] };
  const changes: FieldChange[] = [];

  if (v.status?.trim()) {
    const from = enforcementStatusLabel(target);
    const to = enforcementStatusLabel(d);
    if (from !== to) {
      changes.push({ label: "Durum", from, to });
      merged.status = d.status;
      merged.stopReason = d.stopReason || undefined;
      merged.closeReason = d.closeReason || undefined;
    }
  }
  if (d.type && d.type !== target.type) {
    changes.push({ label: "Takip türü", from: target.type || "—", to: d.type });
    merged.type = d.type;
  }
  if (d.procedure && d.procedure !== (target.procedure ?? "")) {
    changes.push({ label: "Takip şekli", from: target.procedure || "—", to: d.procedure });
    merged.procedure = d.procedure;
  }
  const total = round2(target.principal + (target.interest ?? 0) + (target.costs ?? 0));
  if (v.principal?.trim() && d.principal > 0 && Math.abs(d.principal - total) > 0.005) {
    changes.push({
      label: "Takip çıkış rakamı",
      from: formatMoney(total),
      to: formatMoney(d.principal),
    });
    merged.principal = d.principal;
    merged.interest = 0;
    merged.costs = 0;
  }
  if (d.lastSeizureDate && d.lastSeizureDate > (target.lastSeizureDate ?? "")) {
    changes.push({
      label: "Son haciz tarihi",
      from: target.lastSeizureDate ? formatDate(target.lastSeizureDate) : "—",
      to: formatDate(d.lastSeizureDate),
    });
    merged.lastSeizureDate = d.lastSeizureDate;
  }
  const details = mergeText(target.details ?? "", d.details ?? "");
  if (details !== (target.details ?? "")) {
    changes.push({
      label: "Takip bilgileri",
      from: short(target.details ?? ""),
      to: short(details),
    });
    merged.details = details;
  }
  const note = mergeText(target.note ?? "", d.note ?? "");
  if (note !== (target.note ?? "")) {
    const added = note.split("\n").length - (target.note ?? "").split("\n").length;
    changes.push({
      label: "Açıklamalar",
      from: target.note?.trim() ? "mevcut not korunur" : "—",
      to: target.note?.trim() ? `+${Math.max(added, 1)} yeni satır eklenir` : short(note),
    });
    merged.note = note;
  }

  const fresh = (d.debtorIds ?? []).filter((id) => !merged.debtorIds.includes(id));
  const debtors = (built.debtors ?? []).filter(
    (x): x is Draft<"debtors"> & { id: string } => !!x.id && fresh.includes(x.id),
  );
  if (fresh.length) {
    const names = fresh.map(
      (id) =>
        debtors.find((x) => x.id === id)?.name ??
        ctx.state.debtors.find((x) => x.id === id)?.name ??
        "",
    );
    changes.push({
      label: target.side === "Borçlu" ? "Karşı taraf eklenir" : "Borçlu eklenir",
      from: "",
      to: names.filter(Boolean).join(", "),
    });
    merged.debtorIds = [...merged.debtorIds, ...fresh];
  }
  const blocked = changes.length > 0 && !ctx.permissions.can("enforcements", "edit");
  return { target, merged, changes, debtors, blocked };
}

export const changeText = (c: FieldChange) =>
  c.from ? `${c.label}: ${c.from} → ${c.to}` : `${c.label}: ${c.to}`;

/** Yeni oluşan müvekkil / karşı taraf kartları sonraki satırlarda "kayıtlı" sayılsın (tekrar kart açılmasın) */
export function withNewCards(state: ErpState, batch: ImportBatch): ErpState {
  const now = new Date().toISOString();
  const stamp = { firmId: state.firmId, createdAt: now, updatedAt: now };
  if (!batch.clients?.length && !batch.debtors?.length) return state;
  return {
    ...state,
    clients: [
      ...state.clients,
      ...(batch.clients ?? []).map((c) => ({ ...c, ...stamp }) as Client),
    ],
    debtors: [
      ...state.debtors,
      ...(batch.debtors ?? []).map((d) => ({ ...d, ...stamp }) as Debtor),
    ],
  };
}

/**
 * Yeni satırları ve güncellenecek satırları tek pakette toplar. Güncellemeler sırayla işlenir;
 * önceki satırlarda açılan kartlar sonrakilerde yeniden açılmaz.
 */
export function buildWithUpdates(
  spec: ImportSpec,
  fresh: RowValues[],
  updates: RowValues[],
  ctx: ImportContext,
): { batch: ImportBatch; state: ErpState; updated: number } {
  const batch: ImportBatch = fresh.length ? spec.build(fresh, ctx) : {};
  let state = withNewCards(ctx.state, batch);
  let updated = 0;
  for (const v of updates) {
    const plan = planEnforcementUpdate(spec, v, { ...ctx, state });
    if (!plan?.changes.length || plan.blocked) continue;
    batch.enforcements = [...(batch.enforcements ?? []), plan.merged];
    if (plan.debtors.length) {
      batch.debtors = [...(batch.debtors ?? []), ...plan.debtors];
      state = withNewCards(state, { debtors: plan.debtors });
    }
    updated++;
  }
  return { batch, state, updated };
}
