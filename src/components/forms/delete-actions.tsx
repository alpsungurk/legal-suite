/**
 * Silme işlemleri. Ana kayıtlar (müvekkil, dosya, icra, borçlu, masraf…) çöp kutusuna taşınır:
 * önce sunucudan birlikte gidecek kayıtlar sayılıp onay sorulur, kayıt bağlılarıyla birlikte
 * 30 gün saklanır ve tek tıkla geri yüklenir. Küçük alt kayıtlar (ödeme sözü, görüşme notu) doğrudan silinir.
 */
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useConfirm } from "@/components/app/confirm";
import { useErp } from "@/lib/erp-store";
import type { ContactLog, Debtor, EnforcementFile, PaymentPromise } from "@/lib/erp-types";
import {
  describeCounts,
  MODULE_LABELS,
  TRASH_DAYS,
  TRASH_LABELS,
  trashDelete,
  trashPreview,
  type TrashEntity,
} from "@/lib/trash";

const errorText = (e: unknown) =>
  e && typeof e === "object" && "message" in e ? String((e as Error).message) : String(e);

/**
 * Kayıtları bağlılarıyla birlikte çöp kutusuna taşır. title verilmezse "N <tür>" yazılır.
 * Döner: silindiyse true.
 */
export function useTrashDelete() {
  const { reloadFromServer } = useErp();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return async (entity: TrashEntity, ids: string[], title?: string) => {
    if (!ids.length) return false;
    let preview;
    try {
      preview = await trashPreview(entity, ids);
    } catch (e) {
      toast.error(errorText(e));
      return false;
    }
    if (!preview.found) {
      toast.error("Kayıt bulunamadı; liste yenileniyor");
      void reloadFromServer();
      return false;
    }
    if (preview.missing) {
      toast.error(
        `Bu silme için "${MODULE_LABELS[preview.missing] ?? preview.missing}" silme yetkiniz yok`,
      );
      return false;
    }
    const others = describeCounts(preview.counts, entity);
    const ok = await confirm({
      title: title ?? `${preview.found} ${TRASH_LABELS[entity]} çöp kutusuna taşınsın mı?`,
      confirmLabel: "Çöpe at",
      description: (
        <span className="space-y-2">
          {others && (
            <span className="block">
              Birlikte gidecekler: <b className="text-foreground">{others}</b>.
            </span>
          )}
          {preview.balances && (
            <span className="block">
              Kasa / banka ve müvekkil cari bakiyeleri buna göre değişir.
            </span>
          )}
          <span className="block">
            Çöp kutusundan {TRASH_DAYS} gün içinde hepsi birlikte geri yüklenebilir; sonra kalıcı
            silinir.
          </span>
        </span>
      ),
    });
    if (!ok) return false;
    try {
      const n = await trashDelete(entity, ids);
      await reloadFromServer();
      toast.success(`${n} kayıt çöp kutusuna taşındı`, {
        action: { label: "Çöp kutusu", onClick: () => void navigate({ to: "/cop-kutusu" }) },
      });
      return true;
    } catch (e) {
      toast.error(errorText(e));
      void reloadFromServer();
      return false;
    }
  };
}

/** İcra dosyasını işlemleri, tahsilatları, belgeleri ve ajandasıyla çöpe atar. */
export function useDeleteEnforcement() {
  const trash = useTrashDelete();
  const navigate = useNavigate();
  return async (e: EnforcementFile) => {
    if (!(await trash("enforcements", [e.id], `${e.no} çöp kutusuna taşınsın mı?`))) return false;
    void navigate({ to: e.side === "Borçlu" ? "/icra/borclu" : "/icra" });
    return true;
  };
}

/** Borçlu kartını; dosyalardaki bağı, ödeme sözleri, tahsilatları ve görüşme notlarıyla çöpe atar. */
export function useDeleteDebtor() {
  const trash = useTrashDelete();
  const navigate = useNavigate();
  return async (d: Debtor) => {
    if (!(await trash("debtors", [d.id], `${d.name} çöp kutusuna taşınsın mı?`))) return false;
    if (window.location.pathname.includes(d.id)) void navigate({ to: "/borclular" });
    return true;
  };
}

/** Ödeme sözünü / borçlu taksitini siler. Ona bağlı tahsilat kalır, yalnızca bağı kalkar. */
export function useDeletePromise() {
  const { state, remove } = useErp();
  const confirm = useConfirm();
  return async (p: PaymentPromise) => {
    const paid = state.collections.some((c) => c.promiseId === p.id);
    const ok = await confirm({
      title: "Ödeme sözü silinsin mi?",
      confirmLabel: "Sil",
      description: paid
        ? "Bu söze bağlı bir tahsilat var; tahsilat silinmez, yalnızca sözle bağı kalkar."
        : "Bu işlem geri alınamaz.",
    });
    if (!ok) return false;
    remove("promises", p.id, { reload: paid });
    toast.success("Ödeme sözü silindi");
    return true;
  };
}

/** Görüşme notunu siler */
export function useDeleteContact() {
  const { remove } = useErp();
  const confirm = useConfirm();
  return async (c: ContactLog) => {
    if (!(await confirm({ title: "Görüşme notu silinsin mi?", confirmLabel: "Sil" }))) return false;
    remove("contacts", c.id);
    toast.success("Görüşme notu silindi");
    return true;
  };
}
