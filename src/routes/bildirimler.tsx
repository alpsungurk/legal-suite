import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
export const Route = createFileRoute("/bildirimler")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Bildirim Merkezi"
      description="Büronuzdaki güncel işlem, tahsilat, masraf ve yaklaşan duruşma gelişmelerini takip edin."
      singular="bildirim"
      icon={Bell}
      accent="violet"
      filterOptions={["Tümü", "Tahsilat", "Masraf", "Evrak", "Önemli"]}
      formFields={[
        {
          name: "title",
          label: "Bildirim başlığı",
          placeholder: "Örn. Yeni tahsilat alındı",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "İlgili müvekkil / dosya",
          placeholder: "Kaya Holding • 2026/109",
          required: true,
        },
        {
          name: "meta",
          label: "Tarih ve açıklama",
          type: "textarea",
          placeholder: "28 Temmuz 2026 • 10:30",
          required: true,
          fullWidth: true,
        },
        {
          name: "status",
          label: "Bildirim türü",
          type: "select",
          options: ["Tahsilat", "Masraf", "Evrak", "Önemli", "Dosya değişikliği"],
          required: true,
        },
      ]}
      stats={[
        { label: "Okunmamış", value: "5", note: "İşlem bekliyor" },
        { label: "Bugün", value: "12", note: "Tüm hareketler" },
        { label: "Arşiv", value: "248", note: "Son 90 gün" },
      ]}
      rows={[
        {
          title: "Yeni tahsilat alındı",
          subtitle: "Kaya Holding A.Ş. • 2026/109",
          meta: "₺62.000 • 10 dakika önce",
          status: "Tahsilat",
        },
        {
          title: "Duruşma yaklaşıyor",
          subtitle: "İstanbul 3. Asliye Hukuk • 2026/128",
          meta: "29 Temmuz • 10:30",
          status: "Önemli",
        },
        {
          title: "Masraf eklendi",
          subtitle: "2026/117 dosyasına harç kaydedildi",
          meta: "₺1.850 • 1 saat önce",
          status: "Masraf",
        },
        {
          title: "Evrak yüklendi",
          subtitle: "Bilirkişi Raporu.pdf • 2026/126",
          meta: "Bugün • 09:18",
          status: "Evrak",
        },
      ]}
    />
  );
}
