import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
export const Route = createFileRoute("/raporlar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Raporlar"
      description="Müvekkil, dosya, tahsilat, masraf ve cari hareketlerinizi filtreleyip paylaşılabilir raporlara dönüştürün."
      singular="rapor"
      icon={BarChart3}
      accent="violet"
      filterOptions={["Tümü", "Hazır", "Güncellenmeli"]}
      formFields={[
        {
          name: "title",
          label: "Rapor adı",
          placeholder: "Örn. Tahsilat performans raporu",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "Rapor kapsamı",
          type: "textarea",
          placeholder: "Müvekkil, dosya veya dönem",
          required: true,
          fullWidth: true,
        },
        {
          name: "meta",
          label: "Tarih aralığı",
          placeholder: "01.07.2026 – 31.07.2026",
          required: true,
        },
        {
          name: "reportType",
          label: "Rapor türü",
          type: "select",
          options: [
            "Müvekkil listesi",
            "Dosya listesi",
            "Masraf raporu",
            "Tahsilat raporu",
            "Cari hesap özeti",
          ],
        },
        {
          name: "status",
          label: "Rapor durumu",
          type: "select",
          options: ["Hazır", "Güncellenmeli", "Taslak"],
          required: true,
        },
      ]}
      stats={[
        { label: "Bu ay tahsilat", value: "₺284.500", note: "%12,4 artış" },
        { label: "Bu ay masraf", value: "₺47.300", note: "%4,6 azalış" },
        { label: "Net durum", value: "₺237.200", note: "Tahsilat - masraf" },
      ]}
      rows={[
        {
          title: "Tahsilat performans raporu",
          subtitle: "Ödeme türü, müvekkil ve dosya bazında analiz",
          meta: "Son oluşturma: Bugün, 09:30",
          status: "Hazır",
        },
        {
          title: "Masraf dökümü",
          subtitle: "Kategori ve dosya bazında masraf karşılaştırması",
          meta: "Son oluşturma: 27 Temmuz 2026",
          status: "Hazır",
        },
        {
          title: "Cari hesap özeti",
          subtitle: "Müvekkillerin bakiye ve işlem geçmişi",
          meta: "Son oluşturma: 25 Temmuz 2026",
          status: "Güncellenmeli",
        },
        {
          title: "Dosya aktivite raporu",
          subtitle: "Açık dosyalar, aşamalar ve sorumlu avukatlar",
          meta: "Son oluşturma: 24 Temmuz 2026",
          status: "Hazır",
        },
      ]}
    />
  );
}
