import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
export const Route = createFileRoute("/ayarlar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Ayarlar ve Yetkiler"
      description="Büro kullanıcılarını, rollerini ve sistemde kullanılan dosya, masraf ve hatırlatma kategorilerini yönetin."
      singular="kullanıcı"
      icon={Settings}
      accent="blue"
      filterOptions={["Tümü", "Admin", "Avukat", "Sekreter", "Stajyer"]}
      formFields={[
        {
          name: "title",
          label: "Ad Soyad",
          placeholder: "Örn. Av. Ahmet Yılmaz",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "E-posta adresi",
          placeholder: "ornek@buro.com",
          required: true,
        },
        {
          name: "meta",
          label: "Kullanıcı notu",
          type: "textarea",
          placeholder: "Yetki veya birim bilgisi",
          required: true,
          fullWidth: true,
        },
        {
          name: "role",
          label: "Kullanıcı rolü",
          type: "select",
          options: ["Admin", "Avukat", "Sekreter", "Stajyer"],
        },
        {
          name: "status",
          label: "Yetki rolü",
          type: "select",
          options: ["Admin", "Avukat", "Sekreter", "Stajyer"],
          required: true,
        },
      ]}
      stats={[
        { label: "Aktif kullanıcı", value: "12", note: "4 farklı rol" },
        { label: "Yönetici", value: "2", note: "Tam yetki" },
        { label: "Son giriş", value: "Bugün", note: "09:12" },
      ]}
      rows={[
        {
          title: "Av. Ahmet Yılmaz",
          subtitle: "ahmet@lexyonetim.com",
          meta: "Son giriş: Bugün, 09:12",
          status: "Admin",
        },
        {
          title: "Av. Selin Aras",
          subtitle: "selin@lexyonetim.com",
          meta: "Son giriş: Dün, 18:40",
          status: "Avukat",
        },
        {
          title: "Buse Eren",
          subtitle: "buse@lexyonetim.com",
          meta: "Son giriş: 26 Temmuz, 14:05",
          status: "Sekreter",
        },
        {
          title: "Can Acar",
          subtitle: "can@lexyonetim.com",
          meta: "Son giriş: 25 Temmuz, 10:34",
          status: "Stajyer",
        },
      ]}
    />
  );
}
