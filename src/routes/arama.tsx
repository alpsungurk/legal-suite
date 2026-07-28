import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";

export const Route = createFileRoute("/arama")({ component: Page });

function Page() {
  return (
    <ManagementPage
      title="Global Arama"
      description="Müvekkil, dosya, evrak, telefon ve açıklamalarda tek ekrandan hızlı arama yapın."
      singular="arama kaydı"
      icon={Search}
      accent="blue"
      filterOptions={["Tümü", "Müvekkil", "Dosya", "Evrak"]}
      formFields={[
        {
          name: "title",
          label: "Arama kaydı başlığı",
          placeholder: "Kaydedilen arama adı",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "Arama kapsamı",
          type: "textarea",
          placeholder: "Müvekkil, dosya veya evrak",
          required: true,
          fullWidth: true,
        },
        {
          name: "meta",
          label: "Arama kriteri",
          placeholder: "Anahtar kelime veya numara",
          required: true,
        },
        {
          name: "status",
          label: "Kayıt türü",
          type: "select",
          options: ["Müvekkil", "Dosya", "Evrak"],
          required: true,
        },
      ]}
      stats={[
        { label: "İndekslenen kayıt", value: "2.846", note: "Anlık güncel" },
        { label: "Dosyalar", value: "214", note: "Aranabilir" },
        { label: "Evraklar", value: "1.248", note: "Tam metin" },
      ]}
      searchPlaceholder="Müvekkil, dosya no, telefon veya evrak ara..."
      rows={[
        {
          title: "Ayşe Demir",
          subtitle: "Müvekkil • ayse.demir@email.com",
          meta: "0532 448 21 65 • 2 aktif dosya",
          status: "Müvekkil",
        },
        {
          title: "2026/128 • Alacak davası",
          subtitle: "Dosya • Ayşe Demir",
          meta: "İstanbul 3. Asliye Hukuk • Tebligat",
          status: "Dosya",
        },
        {
          title: "Dava_Dilekçesi_v3.pdf",
          subtitle: "Evrak • 2026/128",
          meta: "PDF • 2,4 MB • 28 Temmuz 2026",
          status: "Evrak",
        },
      ]}
    />
  );
}
