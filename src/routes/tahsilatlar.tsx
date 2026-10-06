import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildPaymentFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";
import type { Payment } from "@/lib/erp-types";

export const Route = createFileRoute("/tahsilatlar")({ component: Page });

function collectedAmount(payment: Payment) {
  if (payment.installments?.length) {
    return payment.installments
      .filter((installment) => installment.status === "Ödendi")
      .reduce((sum, installment) => sum + installment.amount, 0);
  }
  return payment.status === "Tamamlandı" ? payment.amount : 0;
}

function Page() {
  const {
    state,
    findCase,
    findClient,
    caseOptions,
    clientOptions,
    caseIdByLabel,
    clientIdByName,
    caseLabel,
    formatMoney,
    upsertPayment,
    deletePayment,
    markInstallmentPaid,
    permissions,
  } = useErp();

  if (!permissions.canViewPayments) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const total = state.payments.reduce((sum, payment) => sum + collectedAmount(payment), 0);
  const done = state.payments.filter((p) => p.status === "Tamamlandı");
  const columns = [
    { key: "client", label: "Müvekkil", filterable: true },
    { key: "caseNo", label: "Dosya" },
    { key: "type", label: "Ödeme türü", filterable: true },
    { key: "description", label: "Tahsilat kalemi" },
    { key: "date", label: "Parayı alma tarihi" },
    { key: "feePeriod", label: "Aylık ücret dönemi" },
    ...(permissions.canViewFinance ? [{ key: "installments", label: "Taksit" }] : []),
    { key: "amount", label: "Tutar" },
    {
      key: "status",
      label: "Durum",
      filterable: true,
      filterOptions: ["Tamamlandı", "Beklemede", "İptal"],
    },
  ];

  return (
    <ManagementPage
      title="Tahsilatlar"
      description="Tahsilatları ödeme türü ve dosya bazında takip edin; cari bakiyeleri anlık görün."
      singular="tahsilat"
      icon={Wallet}
      accent="green"
      searchPlaceholder="Müvekkil adı, dosya no veya tahsilat ara..."
      columns={columns}
      formFields={buildPaymentFormFields({ clientOptions, caseOptions })}
      canCreate={permissions.canManageFinance}
      canEdit={permissions.canManageFinance}
      canDelete={permissions.canDelete}
      stats={[
        {
          label: "Toplam tahsilat",
          value: formatMoney(total),
          note: `${state.payments.length} işlem`,
        },
        {
          label: "Tamamlanan",
          value: formatMoney(done.reduce((sum, payment) => sum + collectedAmount(payment), 0)),
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
        type: "Peşin",
        taksitPlan: "Tek ödeme",
        description: "Yasal vekalet ücreti",
        date: new Date().toISOString().slice(0, 10),
      }}
      rows={state.payments.map((payment) => {
        const item = payment.caseId ? findCase(payment.caseId) : undefined;
        const directClient = payment.clientId ? findClient(payment.clientId) : undefined;
        const installments = payment.installments ?? [];
        return {
          id: payment.id,
          client:
            directClient?.name ?? (item ? (findClient(item.clientId ?? "")?.name ?? "—") : "—"),
          caseNo: item ? caseLabel(item) : "Dosyasız",
          type: payment.type,
          description: payment.description,
          date: payment.date,
          feePeriod: payment.feePeriod ?? "—",
          installments: installments.length ? `${installments.length} taksit` : "—",
          amount: formatMoney(payment.amount),
          status: payment.status,
          ...(permissions.canViewFinance
            ? {
                installmentDetails: installments.length
                  ? installments
                      .map(
                        (installment, index) =>
                          `${index + 1}. taksit • ${formatMoney(installment.amount)} • ${installment.dueDate} • ${installment.status}`,
                      )
                      .join("\n")
                  : "Taksit planı yok",
              }
            : {}),
        };
      })}
      getEditValues={(row) => {
        const payment = state.payments.find((p) => p.id === row.id);
        const item = payment?.caseId ? findCase(payment.caseId) : undefined;
        const directClient = payment?.clientId ? findClient(payment.clientId) : undefined;
        const installmentCount = payment?.installments?.length ?? 0;
        const plan =
          installmentCount === 2
            ? "2 taksit"
            : installmentCount === 3
              ? "3 taksit"
              : installmentCount === 6
                ? "6 taksit"
                : installmentCount === 12
                  ? "12 taksit"
                  : "Tek ödeme";
        return {
          clientName:
            directClient?.name ?? (item ? (findClient(item.clientId ?? "")?.name ?? "") : ""),
          caseLabel: item ? caseLabel(item) : "",
          date: payment?.date ?? "",
          amount: String(payment?.amount ?? ""),
          type: payment?.type ?? "Peşin",
          feePeriod: payment?.feePeriod ?? "",
          taksitPlan: plan,
          description: "Yasal vekalet ücreti",
          status: payment?.status ?? "Tamamlandı",
        };
      }}
      onSave={(data, editingId) => {
        const caseId = data.caseLabel ? caseIdByLabel(data.caseLabel) : undefined;
        const clientId =
          clientIdByName(data.clientName) ?? (caseId ? findCase(caseId)?.clientId : undefined);
        if (!caseId && !clientId) {
          toast.error("Dosya veya müvekkil seçimi gerekli");
          return;
        }
        const client = clientId ? findClient(clientId) : undefined;
        if (client?.kind === "Kurumsal" && client.monthlyFee && !data.feePeriod) {
          toast.error("Aylık ücretli kurumsal müvekkil için tahsilat dönemini seçin");
          return;
        }
        if (data.feePeriod && (!client || client.kind !== "Kurumsal" || !client.monthlyFee)) {
          toast.error(
            "Aylık ücret dönemi yalnızca aylık ücreti tanımlı kurumsal müvekkilde kullanılabilir",
          );
          return;
        }

        const totalAmount = Number(data.amount) || 0;
        const planName = data.taksitPlan || "Tek ödeme";
        const existingPayment = editingId
          ? state.payments.find((payment) => payment.id === editingId)
          : undefined;

        const countMap: Record<string, number> = {
          "2 taksit": 2,
          "3 taksit": 3,
          "6 taksit": 6,
          "12 taksit": 12,
        };
        const installmentCount = countMap[planName] ?? 0;
        const baseAmount = installmentCount ? Math.floor(totalAmount / installmentCount) : 0;
        const remainder = installmentCount ? totalAmount - baseAmount * installmentCount : 0;
        const installmentIdPrefix = editingId ?? `payment-${Date.now()}`;
        const installments = installmentCount
          ? Array.from({ length: installmentCount }, (_, index) => {
              const [year, month, day] = data.date.split("-").map(Number);
              const monthIndex = month - 1 + index + 1;
              const dueYear = year + Math.floor(monthIndex / 12);
              const dueMonth = ((monthIndex % 12) + 12) % 12;
              const dueDay = Math.min(
                day,
                new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate(),
              );
              const dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay))
                .toISOString()
                .slice(0, 10);
              const installmentId = `${installmentIdPrefix}-${index + 1}`;
              return {
                id: installmentId,
                amount: baseAmount + (index === installmentCount - 1 ? remainder : 0),
                dueDate,
                status:
                  existingPayment?.installments?.find(
                    (installment) => installment.id === installmentId,
                  )?.status ?? ("Bekliyor" as const),
              };
            })
          : undefined;

        upsertPayment({
          id: editingId ?? undefined,
          caseId,
          clientId,
          date: data.date,
          amount: totalAmount,
          type: data.type || "Peşin",
          description: "Yasal vekalet ücreti",
          status: installments?.length ? "Beklemede" : data.status,
          installments,
          feePeriod: data.feePeriod || undefined,
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
