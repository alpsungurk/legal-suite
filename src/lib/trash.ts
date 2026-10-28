/**
 * Çöp kutusu: silinen kayıt bağlılarıyla birlikte sunucuda (public.trash) saklanır, 30 gün içinde
 * geri yüklenebilir. Silme / geri yükleme / kalıcı silme RPC ile yapılır (supabase/migrations/…_cop_kutusu.sql).
 */
import { supabase } from "@/lib/supabase";
import type { CollectionKey, Permissions } from "@/lib/erp-types";

/** Çöpe atılabilen kök kayıt türleri (veritabanı tablo adı) */
export type TrashEntity =
  | "clients"
  | "cases"
  | "enforcements"
  | "debtors"
  | "expenses"
  | "fee_plans"
  | "reminders"
  | "documents"
  | "account_transactions"
  | "salary_garnishments";

export const TRASH_ENTITY: Partial<Record<CollectionKey, TrashEntity>> = {
  clients: "clients",
  cases: "cases",
  enforcements: "enforcements",
  debtors: "debtors",
  expenses: "expenses",
  plans: "fee_plans",
  reminders: "reminders",
  documents: "documents",
  transactions: "account_transactions",
  salaryGarnishments: "salary_garnishments",
};

/** Sayım etiketleri; listede olmayan ara tablolar (bağ, taksit satırı…) kullanıcıya gösterilmez */
export const TRASH_LABELS: Record<string, string> = {
  clients: "müvekkil",
  cases: "dava dosyası",
  enforcements: "icra dosyası",
  debtors: "borçlu kartı",
  payment_promises: "ödeme sözü / taksit",
  collections: "icra tahsilatı",
  contact_logs: "görüşme notu",
  enforcement_events: "icra işlemi",
  expenses: "masraf",
  fee_plans: "tahsilat planı",
  installment_payments: "ücret tahsilatı",
  reminders: "ajanda kaydı",
  documents: "belge",
  account_transactions: "kasa / banka hareketi",
  salary_garnishments: "maaş haczi sırası",
};

/** İzin modülünün okunur adı (yetki hatası için) */
export const MODULE_LABELS: Record<string, string> = {
  clients: "Müvekkiller",
  cases: "Dava dosyaları",
  enforcements: "İcra",
  expenses: "Masraflar",
  fees: "Tahsilatlar",
  reminders: "Ajanda",
  documents: "Belgeler",
  accounts: "Banka / Kasa",
};

export type TrashCounts = Record<string, number>;

export type TrashPreview = {
  counts: TrashCounts;
  found: number;
  /** Eksik "sil" izni olan modül; null ise silinebilir */
  missing: string | null;
  /** Kasa / cari bakiyesini değiştiren kayıtlar da gidiyor */
  balances: boolean;
};

export type TrashItem = {
  id: string;
  entity: TrashEntity;
  label: string;
  counts: TrashCounts;
  deletedBy?: string;
  deletedAt: string;
};

/** Çöp kutusu sayfası: herhangi bir modülde silme izni olan (ya da kendi masrafını silebilen) görür */
export function canUseTrash(p: Permissions) {
  type Module = Parameters<Permissions["can"]>[0];
  return (
    Object.keys(MODULE_LABELS).some((m) => p.can(m as Module, "delete")) ||
    p.can("expenses", "create")
  );
}

/** Çöpte kalma süresi (gün); sonra sunucu kalıcı siler */
export const TRASH_DAYS = 30;

/** "3 dava dosyası, 5 masraf" — kök türü (exclude) bir tane ise yazılmaz */
export function describeCounts(counts: TrashCounts, exclude?: TrashEntity) {
  return Object.entries(counts)
    .filter(([t, n]) => n > 0 && TRASH_LABELS[t] && !(t === exclude && n <= 1))
    .map(([t, n]) => `${n} ${TRASH_LABELS[t]}`)
    .join(", ");
}

export async function trashPreview(entity: TrashEntity, ids: string[]): Promise<TrashPreview> {
  const { data, error } = await supabase.rpc("trash_preview", { p_entity: entity, p_ids: ids });
  if (error) throw error;
  return data as TrashPreview;
}

export async function trashDelete(entity: TrashEntity, ids: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("trash_delete", { p_entity: entity, p_ids: ids });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function trashRestore(id: string) {
  const { error } = await supabase.rpc("trash_restore", { p_id: id });
  if (error) throw error;
}

export async function trashPurge(id: string) {
  const { error } = await supabase.rpc("trash_purge", { p_id: id });
  if (error) throw error;
}

export async function listTrash(): Promise<TrashItem[]> {
  const { data, error } = await supabase
    .from("trash")
    .select("id, entity, label, counts, deleted_by, deleted_at")
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    entity: r.entity as TrashEntity,
    label: String(r.label ?? ""),
    counts: (r.counts ?? {}) as TrashCounts,
    deletedBy: r.deleted_by ? String(r.deleted_by) : undefined,
    deletedAt: String(r.deleted_at),
  }));
}
