import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { caseOptions, clientOptions, findCase, findClient, payments } from "@/lib/erp-data";
import { paymentFormFields } from "@/lib/management-form-config";

export const Route = createFileRoute("/tahsilatlar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Tahsilatlar"
      description="Tahsilatları ödeme türü ve dosya bazında takip edin; cari bakiyeleri anlık görün."
      singular="tahsilat"
      icon={Wallet}
      accent="green"
      filterOptions={["Tümü", "Tamamlandı", "Beklemede"]}
      formFields={paymentFormFields}
      stats={[
        { label: "Bugünkü tahsilat", value: "₺86.500", note: "4 işlem" },
        { label: "Bu ay", value: "₺284.500", note: "%12,4 artış" },
        { label: "Geciken bakiye", value: "₺23.000", note: "4 müvekkil" },
      ]}
      rows={payments.map((payment) => {
        const item = findCase(payment.caseId);
        return {
          title: findClient(item.clientId).name,
          subtitle: `${item.no} • ${payment.type}`,
          meta: `${payment.date} • Açıklama: ${payment.description}`,
          status: payment.status,
          amount: `₺${payment.amount.toLocaleString("tr-TR")}`,
        };
      })}
    />
  );
}
