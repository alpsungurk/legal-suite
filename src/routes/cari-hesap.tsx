import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/cari-hesap")({ component: Page });

function Page() {
  const { state, formatMoney } = useErp();

  const rows = state.clients.map((client) => {
    const clientCases = state.cases.filter((c) => c.clientId === client.id);
    const caseIds = new Set(clientCases.map((c) => c.id));
    const payments = state.payments
      .filter((p) => caseIds.has(p.caseId) && p.status === "Tamamlandı")
      .reduce((s, p) => s + p.amount, 0);
    const expenses = state.expenses
      .filter((e) => caseIds.has(e.caseId))
      .reduce((s, e) => s + e.amount, 0);
    const balance = payments - expenses;
    const lastPayment = state.payments
      .filter((p) => caseIds.has(p.caseId))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      id: client.id,
      client: client.name,
      kind: client.kind,
      activeCases: String(clientCases.filter((c) => c.stage !== "Kapalı").length),
      lastTx: lastPayment
        ? `${lastPayment.date} • ${lastPayment.type}`
        : "İşlem yok",
      balance: formatMoney(balance),
      status: balance < 0 ? "Önemli" : "Güncel",
    };
  });

  const totalPay = state.payments
    .filter((p) => p.status === "Tamamlandı")
    .reduce((s, p) => s + p.amount, 0);
  const totalExp = state.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <ManagementPage
      title="Cari Hesap"
      description="Müvekkil bazlı tahsilat, masraf ve kalan bakiye durumunu anlık olarak takip edin."
      singular="cari hesap kaydı"
      icon={Landmark}
      accent="green"
      readOnly
      canCreate={false}
      columns={[
        { key: "client", label: "Müvekkil" },
        { key: "kind", label: "Tür", filterable: true },
        { key: "activeCases", label: "Aktif dosya" },
        { key: "lastTx", label: "Son işlem" },
        { key: "balance", label: "Bakiye" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Güncel", "Önemli"],
        },
      ]}
      stats={[
        { label: "Toplam tahsilat", value: formatMoney(totalPay), note: "Tamamlanan" },
        { label: "Toplam masraf", value: formatMoney(totalExp), note: "Kayıtlı" },
        { label: "Net bakiye", value: formatMoney(totalPay - totalExp), note: "Tahsilat - masraf" },
      ]}
      rows={rows}
    />
  );
}
