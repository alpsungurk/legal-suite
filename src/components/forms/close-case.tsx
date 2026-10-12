import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useConfirm } from "@/components/app/confirm";
import { useErp } from "@/lib/erp-store";
import { caseLabel } from "@/lib/finance";

/**
 * Dosyayı kapatır: dosya, masraf/makbuz, tahsilat planı, ajanda ve belgeleri silinir;
 * müvekkil kalır ve yalnızca toplam alacak / verecek ile ücret toplamları sayı olarak saklanır.
 */
export function useCloseCase() {
  const { state, closeCase } = useErp();
  const confirm = useConfirm();
  const navigate = useNavigate();

  return async (caseId: string): Promise<boolean> => {
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return false;
    const n = {
      expenses: state.expenses.filter((e) => e.caseId === caseId).length,
      plans: state.plans.filter((p) => p.caseId === caseId).length,
      docs: state.documents.filter((d) => d.caseId === caseId).length,
      reminders: state.reminders.filter((r) => r.caseId === caseId).length,
    };
    const ok = await confirm({
      title: "Dosya kapatılsın ve silinsin mi?",
      confirmLabel: "Kapat ve sil",
      description: (
        <span className="space-y-2">
          <span className="block">
            {caseLabel(c)} dosyası ile {n.expenses} masraf (makbuzlarıyla), {n.plans} tahsilat
            planı, {n.docs} belge ve {n.reminders} ajanda kaydı kalıcı olarak silinecek.
          </span>
          <span className="block">
            Müvekkil kalır; yalnızca toplam alacak / toplam verecek ve ücret toplamları sayı olarak
            saklanır. Bu işlem geri alınamaz.
          </span>
        </span>
      ),
    });
    if (!ok) return false;
    closeCase(caseId);
    toast.success("Dosya kapatıldı; müvekkilde yalnızca toplamlar kaldı");
    if (typeof window !== "undefined" && window.location.pathname.includes(caseId)) {
      void navigate({ to: "/dosyalar" });
    }
    return true;
  };
}
