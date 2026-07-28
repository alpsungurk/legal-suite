import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";

export const Route = createFileRoute("/cari-hesap")({ component: Page });

function Page() {
  return (
    <ManagementPage
      title="Cari Hesap"
      description="Müvekkil bazlı tahsilat, masraf ve kalan bakiye durumunu anlık olarak takip edin."
      singular="cari hesap kaydı"
      icon={Landmark}
      accent="green"
      filterOptions={["Tümü", "Güncel", "Önemli"]}
      formFields={[
        {
          name: "title",
          label: "Müvekkil",
          type: "select",
          options: ["Ayşe Demir", "Kaya Holding A.Ş.", "Mehmet Kaya", "Fatma Öz"],
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "Dosya",
          type: "select",
          options: [
            "2026/128 • Alacak davası",
            "2026/109 • Ticari uyuşmazlık",
            "2026/098 • Kira uyuşmazlığı",
          ],
          required: true,
        },
        {
          name: "meta",
          label: "Son işlem bilgisi",
          placeholder: "Tarih • Ödeme türü",
          required: true,
        },
        { name: "amount", label: "Kalan bakiye", type: "number", placeholder: "0", required: true },
        {
          name: "status",
          label: "Hesap durumu",
          type: "select",
          options: ["Güncel", "Önemli", "Kapalı"],
          required: true,
        },
      ]}
      stats={[
        { label: "Toplam tahsilat", value: "₺284.500", note: "Bu ay" },
        { label: "Toplam masraf", value: "₺47.300", note: "Bu ay" },
        { label: "Net bakiye", value: "₺237.200", note: "Pozitif bakiye" },
      ]}
      rows={[
        {
          title: "Kaya Holding A.Ş.",
          subtitle: "7 aktif dosya • Kurumsal müvekkil",
          meta: "Son işlem: 28 Temmuz 2026 • Havale",
          status: "Güncel",
          amount: "₺112.400",
        },
        {
          title: "Ayşe Demir",
          subtitle: "2 aktif dosya • Bireysel müvekkil",
          meta: "Son işlem: 28 Temmuz 2026 • Kredi kartı",
          status: "Güncel",
          amount: "₺24.500",
        },
        {
          title: "Fatma Öz",
          subtitle: "1 aktif dosya • Bireysel müvekkil",
          meta: "Son işlem: 22 Temmuz 2026 • Vade geçti",
          status: "Önemli",
          amount: "-₺3.200",
        },
      ]}
    />
  );
}
