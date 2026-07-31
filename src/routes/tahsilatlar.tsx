import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildPaymentFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/tahsilatlar")({ component: Page });

function Page() {
  const {
    state,
    findCase,
    findClient,
    caseOptions,
    clientOptions,
    caseIdByLabel,
    caseLabel,
    formatMoney,
    upsertPayment,
    deletePayment,
    permissions,
  } = useErp();

  const total = state.payments.reduce((s, p) => s + p.amount, 0);
  const done = state.payments.filter((p) => p.status === "Tamamlandı");

  return (
    <ManagementPage
      title="Tahsilatlar"
      description="Tahsilatları ödeme türü ve dosya bazında takip edin; cari bakiyeleri anlık görün."
      singular="tahsilat"
      icon={Wallet}
      accent="green"
      columns={[
        { key: "client", label: "Müvekkil", filterable: true },
        { key: "caseNo", label: "Dosya" },
        { key: "type", label: "Ödeme türü", filterable: true },
        { key: "description", label: "Açıklama" },
        { key: "date", label: "Tarih" },
        { key: "amount", label: "Tutar" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Tamamlandı", "Beklemede", "İptal"],
        },
      ]}
      formFields={buildPaymentFormFields({ clientOptions, caseOptions })}
      canCreate={permissions.canWrite}
      canEdit={permissions.canWrite}
      canDelete={permissions.canDelete}
      stats={[
        {
          label: "Toplam tahsilat",
          value: formatMoney(total),
          note: `${state.payments.length} işlem`,
        },
        {
          label: "Tamamlanan",
          value: formatMoney(done.reduce((s, p) => s + p.amount, 0)),
          note: `${done.length} kayıt`,
        },
        {
          label: "Bekleyen",
          value: String(state.payments.filter((p) => p.status === "Beklemede").length),
          note: "Takipte",
        },
      ]}
      emptyCreateValues={{
        status: "Tamamlandı",
        type: "Havale",
        date: new Date().toISOString().slice(0, 10),
      }}
      rows={state.payments.map((payment) => {
        const item = findCase(payment.caseId);
        return {
          id: payment.id,
          client: item ? (findClient(item.clientId)?.name ?? "—") : "—",
          caseNo: item ? caseLabel(item) : "—",
          type: payment.type,
          description: payment.description,
          date: payment.date,
          amount: formatMoney(payment.amount),
          status: payment.status,
        };
      })}
      getEditValues={(row) => {
        const payment = state.payments.find((p) => p.id === row.id);
        const item = payment ? findCase(payment.caseId) : undefined;
        return {
          clientName: item ? (findClient(item.clientId)?.name ?? "") : "",
          caseLabel: item ? caseLabel(item) : "",
          date: payment?.date ?? "",
          amount: String(payment?.amount ?? ""),
          type: payment?.type ?? "Havale",
          description: payment?.description ?? "",
          status: payment?.status ?? "Tamamlandı",
        };
      }}
      onSave={(data, editingId) => {
        const caseId = caseIdByLabel(data.caseLabel);
        if (!caseId) {
          toast.error("Dosya seçimi geçersiz");
          return;
        }
        upsertPayment({
          id: editingId ?? undefined,
          caseId,
          date: data.date,
          amount: Number(data.amount) || 0,
          type: data.type || "Havale",
          description: data.description,
          status: data.status,
        });
        toast.success(editingId ? "Tahsilat güncellendi" : "Yeni tahsilat eklendi");
      }}
      onDelete={(id) => {
        deletePayment(id);
        toast.success("Tahsilat silindi");
      }}
    />
  );
}
