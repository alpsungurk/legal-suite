import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck, Receipt } from "lucide-react";
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

  if (!permissions.canViewFinance) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const filtered = tur ? state.expenses.filter((e) => e.type === tur) : state.expenses;
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const pending = filtered.filter((e) => e.status === "Onay bekliyor" || e.status === "Beklemede");

  const markAsReceived = (id: string) => {
    const expense = state.expenses.find((row) => row.id === id);
    if (!expense) return;
    upsertExpense({
      ...expense,
      status: "Alındı",
      recordDate: expense.recordDate ?? expense.date,
    });
    toast.success("Masraf alındı olarak işaretlendi");
  };

  return (
    <ManagementPage
      title={tur ? `Masraflar — ${tur}` : "Masraflar"}
      description="Dosya veya müvekkil bazlı masraf hareketlerini tek ekranda takip edin."
      singular="masraf"
      icon={Receipt}
      accent="amber"
      searchPlaceholder="Müvekkil adı, dosya no veya masraf ara..."
      columns={[
        { key: "title", label: "Açıklama" },
        { key: "caseNo", label: "Dosya" },
        { key: "client", label: "Müvekkil", filterable: true },
        { key: "direction", label: "Yön", filterable: true },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: state.expenseTypes,
        },
        { key: "payer", label: "Ödeyen", filterable: true },
        { key: "date", label: "Tarih" },
        { key: "recordDate", label: "Alacak tarihi" },
        { key: "amount", label: "Tutar" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Alındı", "Belgelendi", "Onay bekliyor", "Belgesiz", "Beklemede"],
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
      customRowActions={
        permissions.canMarkExpenseReceived
          ? [
              {
                label: "Masrafı alındı",
                icon: CheckCheck,
                onClick: (row) => markAsReceived(row.id),
              },
            ]
          : []
      }
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
        direction: "Giden",
        recordDate: new Date().toISOString().slice(0, 10),
        type: tur ?? state.expenseTypes[0] ?? "Diğer",
        date: new Date().toISOString().slice(0, 10),
      }}
      rows={filtered.map((expense) => {
        const item = expense.caseId ? findCase(expense.caseId) : undefined;
        const directClient = expense.clientId ? findClient(expense.clientId) : undefined;
        return {
          id: expense.id,
          title: expense.title,
          caseNo: item ? caseLabel(item) : "Dosyasız",
          client:
            directClient?.name ?? (item ? (findClient(item.clientId ?? "")?.name ?? "—") : "—"),
          direction: expense.direction ?? "Giden",
          type: expense.type,
          payer: expense.payer,
          date: expense.date,
          recordDate: expense.recordDate ?? expense.date,
          amount: formatMoney(expense.amount),
          status: expense.status,
        };
      })}
      getEditValues={(row) => {
        const expense = state.expenses.find((e) => e.id === row.id);
        const item = expense?.caseId ? findCase(expense.caseId) : undefined;
        const directClient = expense?.clientId ? findClient(expense.clientId) : undefined;
        return {
          title: expense?.title ?? "",
          caseLabel: item ? caseLabel(item) : "",
          date: expense?.date ?? "",
          clientName:
            directClient?.name ?? (item ? (findClient(item.clientId ?? "")?.name ?? "") : ""),
          direction: expense?.direction ?? "Giden",
          recordDate: expense?.recordDate ?? expense?.date ?? "",
          payer: expense?.payer ?? "Büro",
          amount: String(expense?.amount ?? ""),
          type: expense?.type ?? "Diğer",
          status: expense?.status ?? "Belgelendi",
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
        upsertExpense({
          id: editingId ?? undefined,
          title: data.title,
          caseId,
          clientId,
          date: data.date,
          payer: data.payer || "Büro",
          amount: Number(data.amount) || 0,
          type: data.type,
          status: data.status,
          direction: (data.direction as "Gelen" | "Giden") || "Giden",
          recordDate: data.recordDate,
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
