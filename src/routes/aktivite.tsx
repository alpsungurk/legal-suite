import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";

export const Route = createFileRoute("/aktivite")({ component: Page });

function Page() {
  return (
    <ManagementPage
      title="Aktivite Geçmişi"
      description="Büroda yapılan tüm kayıt, güncelleme, belge yükleme ve finansal işlemleri izleyin."
      singular="aktivite"
      icon={History}
      accent="violet"
      filterOptions={["Tümü", "Tahsilat", "Evrak", "Güncellendi"]}
      formFields={[
        {
          name: "title",
          label: "İşlem başlığı",
          placeholder: "Örn. Dosya durumu güncellendi",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "İşlemi yapan kullanıcı",
          placeholder: "Av. Ahmet Yılmaz",
          required: true,
        },
        {
          name: "meta",
          label: "İşlem detayları",
          type: "textarea",
          placeholder: "Tarih • Dosya no",
          required: true,
          fullWidth: true,
        },
        { name: "amount", label: "İşlem tutarı", type: "number", placeholder: "İsteğe bağlı" },
        {
          name: "status",
          label: "İşlem türü",
          type: "select",
          options: ["Tahsilat", "Masraf", "Evrak", "Güncellendi", "Giriş"],
          required: true,
        },
      ]}
      stats={[
        { label: "Bugünkü işlem", value: "28", note: "4 kullanıcı" },
        { label: "Bu hafta", value: "174", note: "İzlenebilir kayıt" },
        { label: "Oturumlar", value: "12", note: "Aktif kullanıcı" },
      ]}
      rows={[
        {
          title: "Yeni tahsilat kaydedildi",
          subtitle: "Av. Ahmet Yılmaz • Kaya Holding A.Ş.",
          meta: "28 Temmuz 2026, 10:22 • 2026/109",
          status: "Tahsilat",
          amount: "₺62.000",
        },
        {
          title: "Bilirkişi raporu yüklendi",
          subtitle: "Buse Eren • 2026/126 dosyası",
          meta: "28 Temmuz 2026, 09:18 • PDF",
          status: "Evrak",
        },
        {
          title: "Dosya durumu güncellendi",
          subtitle: "Av. Selin Aras • 2026/127 dosyası",
          meta: "27 Temmuz 2026, 18:40 • Ön inceleme",
          status: "Güncellendi",
        },
      ]}
    />
  );
}
