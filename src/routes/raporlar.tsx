import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/raporlar")({ component: Page });

function Page() {
  const { state, formatMoney } = useErp();
  const totalPay = state.payments
    .filter((p) => p.status === "Tamamlandı")
    .reduce((s, p) => s + p.amount, 0);
  const totalExp = state.expenses.reduce((s, e) => s + e.amount, 0);

  const rows = [
    {
      id: "r1",
      title: "Tahsilat performans raporu",
      scope: "Ödeme türü, müvekkil ve dosya bazında analiz",
      updated: "Canlı veri",
      status: "Hazır",
    },
    {
      id: "r2",
      title: "Masraf dökümü",
      scope: "Kategori ve dosya bazında masraf karşılaştırması",
      updated: "Canlı veri",
      status: "Hazır",
    },
    {
      id: "r3",
      title: "Cari hesap özeti",
      scope: "Müvekkillerin bakiye ve işlem geçmişi",
      updated: "Canlı veri",
      status: "Hazır",
    },
    {
      id: "r4",
      title: "Dosya aktivite raporu",
      scope: `${state.cases.length} dosya • ${state.activities.length} hareket`,
      updated: "Canlı veri",
      status: state.activities.length ? "Hazır" : "Güncellenmeli",
    },
  ];

  return (
    <ManagementPage
      title="Raporlar"
      description="Müvekkil, dosya, tahsilat, masraf ve cari hareketlerinizi filtreleyip paylaşılabilir raporlara dönüştürün."
      singular="rapor"
      icon={BarChart3}
      accent="violet"
      readOnly
      columns={[
        { key: "title", label: "Rapor" },
        { key: "scope", label: "Kapsam" },
        { key: "updated", label: "Güncelleme" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Hazır", "Güncellenmeli"],
        },
      ]}
      stats={[
        { label: "Tahsilat", value: formatMoney(totalPay), note: "Tamamlanan" },
        { label: "Masraf", value: formatMoney(totalExp), note: "Toplam" },
        { label: "Net", value: formatMoney(totalPay - totalExp), note: "Tahsilat - masraf" },
      ]}
      rows={rows}
    />
  );
}
