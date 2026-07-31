import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildExpenseFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

type Search = { tur?: string };

export const Route = createFileRoute("/masraflar")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tur: typeof search.tur === "string" ? search.tur : undefined,
  }),
  component: Page,
});

function Page() {
  const { tur } = Route.useSearch();
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
    upsertExpense,
    deleteExpense,
    permissions,
  } = useErp();

  const filtered = tur ? state.expenses.filter((e) => e.type === tur) : state.expenses;
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const pending = filtered.filter((e) => e.status === "Onay bekliyor");

  return (
    <ManagementPage
      title={tur ? `Masraflar — ${tur}` : "Masraflar"}
      description="Dosya bazlı tüm harç, bilirkişi, tebligat ve ofis giderlerini belgesiyle birlikte kaydedin."
      singular="masraf"
      icon={Receipt}
      accent="amber"
      columns={[
        { key: "title", label: "Açıklama" },
        { key: "caseNo", label: "Dosya" },
        { key: "client", label: "Müvekkil", filterable: true },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: state.expenseTypes,
        },
        { key: "payer", label: "Ödeyen", filterable: true },
        { key: "date", label: "Tarih" },
        { key: "amount", label: "Tutar" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Belgelendi", "Onay bekliyor", "Belgesiz"],
        },
      ]}
      formFields={buildExpenseFormFields({
        caseOptions,
        clientOptions,
        expenseTypes: state.expenseTypes,
      })}
      canCreate={permissions.canWrite}
      canEdit={permissions.canWrite}
      canDelete={permissions.canDelete}
      stats={[
        { label: "Toplam", value: formatMoney(total), note: tur ? tur : "Tüm masraflar" },
        {
          label: "Bekleyen onay",
          value: formatMoney(pending.reduce((s, e) => s + e.amount, 0)),
          note: `${pending.length} işlem`,
        },
        { label: "Kayıt", value: String(filtered.length), note: "Listelenen" },
      ]}
      emptyCreateValues={{
        status: "Belgelendi",
        payer: "Büro",
        type: tur ?? state.expenseTypes[0] ?? "Harç",
        date: new Date().toISOString().slice(0, 10),
      }}
      rows={filtered.map((expense) => {
        const item = findCase(expense.caseId);
        return {
          id: expense.id,
          title: expense.title,
          caseNo: item ? caseLabel(item) : "—",
          client: item ? (findClient(item.clientId)?.name ?? "—") : "—",
          type: expense.type,
          payer: expense.payer,
          date: expense.date,
          amount: formatMoney(expense.amount),
          status: expense.status,
        };
      })}
      getEditValues={(row) => {
        const expense = state.expenses.find((e) => e.id === row.id);
        const item = expense ? findCase(expense.caseId) : undefined;
        return {
          title: expense?.title ?? "",
          caseLabel: item ? caseLabel(item) : "",
          date: expense?.date ?? "",
          clientName: item ? (findClient(item.clientId)?.name ?? "") : "",
          payer: expense?.payer ?? "Büro",
          amount: String(expense?.amount ?? ""),
          type: expense?.type ?? "",
          status: expense?.status ?? "Belgelendi",
        };
      }}
      onSave={(data, editingId) => {
        const caseId = caseIdByLabel(data.caseLabel);
        if (!caseId) {
          toast.error("Dosya seçimi geçersiz");
          return;
        }
        upsertExpense({
          id: editingId ?? undefined,
          title: data.title,
          caseId,
          date: data.date,
          clientId: clientIdByName(data.clientName),
          payer: data.payer || "Büro",
          amount: Number(data.amount) || 0,
          type: data.type,
          status: data.status,
        });
        toast.success(editingId ? "Masraf güncellendi" : "Yeni masraf eklendi");
      }}
      onDelete={(id) => {
        deleteExpense(id);
        toast.success("Masraf silindi");
      }}
    />
  );
}
