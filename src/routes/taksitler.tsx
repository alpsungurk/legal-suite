import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/taksitler")({ component: Page });

function Page() {
  const { state, findCase, findClient, caseLabel, formatMoney, markInstallmentPaid, permissions } =
    useErp();

  if (!permissions.canViewFinance) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const rows = state.payments.flatMap((payment) => {
    const caseFile = payment.caseId ? findCase(payment.caseId) : undefined;
    const client = payment.clientId
      ? findClient(payment.clientId)
      : caseFile?.clientId
        ? findClient(caseFile.clientId)
        : undefined;

    return (payment.installments ?? []).map((installment) => {
      const status =
        installment.status === "Bekliyor" &&
        installment.dueDate < new Date().toISOString().slice(0, 10)
          ? "Gecikmiş"
          : installment.status;
      return {
        id: `${payment.id}-${installment.id}`,
        paymentId: payment.id,
        installmentId: installment.id,
        client: client?.name ?? "—",
        caseNo: caseFile ? caseLabel(caseFile) : "Dosyasız",
        dueDate: installment.dueDate,
        amount: formatMoney(installment.amount),
        status,
      };
    });
  });

  const pending = rows.filter((row) => row.status !== "Ödendi");
  const overdue = rows.filter((row) => row.status === "Gecikmiş");

  return (
    <ManagementPage
      title="Taksit Takibi"
      description="Tahsilat planlarındaki vade, tutar ve ödeme durumlarını takip edin."
      singular="taksit"
      icon={CalendarClock}
      accent="violet"
      columns={[
        { key: "client", label: "Müvekkil", filterable: true },
        { key: "caseNo", label: "Dosya" },
        { key: "dueDate", label: "Taksit tarihi" },
        { key: "amount", label: "Taksit tutarı" },
        {
          key: "status",
          label: "Taksit durumu",
          filterable: true,
          filterOptions: ["Bekliyor", "Gecikmiş", "Ödendi"],
        },
      ]}
      canCreate={false}
      canEdit={false}
      canDelete={false}
      customRowActions={[
        {
          label: "Ödendi olarak işaretle",
          icon: CheckCheck,
          isVisible: (row) => row.status !== "Ödendi",
          onClick: (row) => {
            markInstallmentPaid(row.paymentId, row.installmentId);
            toast.success("Taksit ödendi olarak işaretlendi");
          },
        },
      ]}
      stats={[
        { label: "Toplam taksit", value: String(rows.length), note: "Tüm tahsilat planları" },
        { label: "Bekleyen / geciken", value: String(pending.length), note: "Açık taksitler" },
        { label: "Vadesi geçen", value: String(overdue.length), note: "Gecikmiş taksitler" },
      ]}
      rows={rows}
    />
  );
}
