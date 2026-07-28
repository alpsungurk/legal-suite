import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { caseOptions, clientOptions, expenses, findCase, findClient } from "@/lib/erp-data";
import { expenseFormFields } from "@/lib/management-form-config";

export const Route = createFileRoute("/masraflar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Masraflar"
      description="Dosya bazlı tüm harç, bilirkişi, tebligat ve ofis giderlerini belgesiyle birlikte kaydedin."
      singular="masraf"
      icon={Receipt}
      accent="amber"
      filterOptions={["Tümü", "Belgelendi", "Onay bekliyor"]}
      formFields={expenseFormFields}
      stats={[
        { label: "Bu ay", value: "₺47.300", note: "%4,6 azalış" },
        { label: "Bekleyen onay", value: "₺8.650", note: "6 işlem" },
        { label: "Belgesiz kayıt", value: "3", note: "İncelenmeli" },
      ]}
      rows={expenses.map((expense) => {
        const item = findCase(expense.caseId);
        return {
          title: expense.title,
          subtitle: `${item.no} • ${findClient(item.clientId).name}`,
          meta: `${expense.date} • Ödeyen: ${expense.payer}`,
          status: expense.status,
          amount: `₺${expense.amount.toLocaleString("tr-TR")}`,
        };
      })}
    />
  );
}
