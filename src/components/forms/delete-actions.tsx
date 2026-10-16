/**
 * Kalıcı silme işlemleri: önce bağlı kayıtlar denetlenir, parayı (kasa / cari) etkileyecek silmeler
 * engellenir, sonra ne silineceği açıkça yazılan bir onay sorulur.
 */
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useConfirm } from "@/components/app/confirm";
import { useErp } from "@/lib/erp-store";
import type { ContactLog, Debtor, EnforcementFile, PaymentPromise } from "@/lib/erp-types";

/** İcra dosyasını siler. Tahsilatı olan dosya silinemez (kasa ve cari bakiye bozulur). */
export function useDeleteEnforcement() {
  const { state, remove } = useErp();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return async (e: EnforcementFile) => {
    const collections = state.collections.filter((c) => c.enforcementId === e.id).length;
    if (collections) {
      toast.error(
        `Bu dosyada ${collections} tahsilat var; silmek kasa ve cari bakiyeleri değiştirir. Önce tahsilatları silin ya da dosyayı "Kapalı" yapın.`,
      );
      return false;
    }
    const n = {
      promises: state.promises.filter((p) => p.enforcementId === e.id).length,
      events: state.events.filter((x) => x.enforcementId === e.id).length,
      contacts: state.contacts.filter((c) => c.enforcementId === e.id).length,
      documents: state.documents.filter((d) => d.enforcementId === e.id).length,
      reminders: state.reminders.filter((r) => r.enforcementId === e.id).length,
      expenses: state.expenses.filter((x) => x.enforcementId === e.id).length,
    };
    const ok = await confirm({
      title: `${e.no} kalıcı olarak silinsin mi?`,
      confirmLabel: "Kalıcı sil",
      description: (
        <span className="space-y-2">
          <span className="block">
            Dosyayla birlikte {n.promises} ödeme sözü / taksit, {n.events} işlem kaydı,{" "}
            {n.contacts} görüşme notu, {n.documents} belge ve {n.reminders} ajanda kaydı silinir.
          </span>
          {n.expenses > 0 && (
            <span className="block">
              {n.expenses} masraf silinmez; yalnızca bu dosyayla bağı kalkar.
            </span>
          )}
          <span className="block">
            Borçlu kartları silinmez. Bu işlem geri alınamaz; takip bittiyse silmek yerine dosyayı
            "Kapalı" yapmanız önerilir.
          </span>
        </span>
      ),
    });
    if (!ok) return false;
    remove("enforcements", e.id, { reload: true });
    toast.success("İcra dosyası silindi");
    void navigate({ to: e.side === "Borçlu" ? "/icra/borclu" : "/icra" });
    return true;
  };
}

/** Borçlu kartını siler. Bir icra dosyasında, ödeme sözünde ya da tahsilatta geçiyorsa silinemez. */
export function useDeleteDebtor() {
  const { state, remove } = useErp();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return async (d: Debtor) => {
    const files = state.enforcements.filter((e) => e.debtorIds.includes(d.id));
    if (files.length) {
      toast.error(
        `Bu kart ${files.length} icra dosyasında geçiyor (${files
          .slice(0, 3)
          .map((e) => e.no)
          .join(", ")}${files.length > 3 ? "…" : ""}). Önce dosyalardan çıkarın.`,
      );
      return false;
    }
    if (state.collections.some((c) => c.debtorId === d.id) || state.promises.some((p) => p.debtorId === d.id)) {
      toast.error("Bu borçlunun ödeme sözü ya da tahsilat kaydı var; önce onları silin.");
      return false;
    }
    const contacts = state.contacts.filter((c) => c.debtorId === d.id).length;
    const ok = await confirm({
      title: `${d.name} silinsin mi?`,
      confirmLabel: "Sil",
      description: contacts
        ? `Kartla birlikte ${contacts} görüşme notu da silinir. Bu işlem geri alınamaz.`
        : "Bu işlem geri alınamaz.",
    });
    if (!ok) return false;
    remove("debtors", d.id, { reload: contacts > 0 });
    toast.success("Borçlu silindi");
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
