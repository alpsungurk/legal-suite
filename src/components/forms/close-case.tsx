import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useConfirm } from "@/components/app/confirm";
import { useErp } from "@/lib/erp-store";
import { caseLabel } from "@/lib/finance";
import { addMonths, formatDate, today } from "@/lib/format";
import type { CaseFile } from "@/lib/erp-types";

/**
 * Kapalı dosyanın kalıcı silineceği tarih: saklama süresi (kapanış + ayardaki ay) dolduktan sonraki
 * ilk ay başı. Silme işi her ayın 1'inde çalışır.
 */
export function purgeDateFor(closingDate: string | undefined, months: number) {
  if (months <= 0) return "";
  const due = addMonths(closingDate || today(), months);
  return due.endsWith("-01") ? due : `${addMonths(due, 1).slice(0, 8)}01`;
}

export function casePurgeDate(c: Pick<CaseFile, "status" | "closingDate">, months: number) {
  return c.status === "Kapalı" && months > 0 ? purgeDateFor(c.closingDate, months) : undefined;
}

/**
 * Kapatma onayı. Dosya silinmez: kayıtlarıyla birlikte kapalı olarak saklanır. Yalnızca Ayarlar'da
 * otomatik silme süresi verildiyse o süre dolunca bir sonraki ay başında silinir.
 */
export function useCloseConfirm() {
  const { state } = useErp();
  const confirm = useConfirm();
  return async (caseId: string): Promise<boolean> => {
    const c = state.cases.find((x) => x.id === caseId);
    if (!c) return false;
    const months = state.settings.closedCaseRetentionMonths;
    return confirm({
      title: "Dosya kapatılsın mı?",
      confirmLabel: "Kapat",
      description: (
        <span className="space-y-2">
          {months > 0 ? (
            <>
              <span className="block">
                {caseLabel(c)} dosyası ve bütün kayıtları (masraf, tahsilat, belge, ajanda){" "}
                <b>{months} ay</b> boyunca kapalı olarak saklanır; bu sürede yeniden açabilirsiniz.
              </span>
              <span className="block">
                {formatDate(purgeDateFor(undefined, months))} tarihinde (silme işi ayın başında
                çalışır) kayıtlar silinir. Müvekkilde yalnızca toplam alacak / verecek ve ücret
                toplamları kalır.
              </span>
            </>
          ) : (
            <span className="block">
              {caseLabel(c)} dosyası ve bütün kayıtları (masraf, tahsilat, belge, ajanda) kapalı
              olarak saklanır; siz silmedikçe silinmez. İstediğiniz zaman yeniden açabilirsiniz.
            </span>
          )}
        </span>
      ),
    });
  };
}

/** Dosyayı kapatır (silmez) */
export function useCloseCase() {
  const { patch } = useErp();
  const ask = useCloseConfirm();
  return async (caseId: string): Promise<boolean> => {
    if (!(await ask(caseId))) return false;
    patch("cases", caseId, { status: "Kapalı", closingDate: today() });
    toast.success("Dosya kapatıldı");
    return true;
  };
}

/** Kapalı dosyayı beklemeden kalıcı siler: müvekkilde yalnızca toplamlar kalır */
export function usePurgeCase() {
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
      title: "Dosya şimdi kalıcı olarak silinsin mi?",
      confirmLabel: "Kalıcı sil",
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
    if (typeof window !== "undefined" && window.location.pathname.includes(caseId)) {
      void navigate({ to: "/dosyalar" });
    }
    return true;
  };
}
