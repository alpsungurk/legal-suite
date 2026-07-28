import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { caseOptions, clientOptions } from "@/lib/erp-data";

export const Route = createFileRoute("/hatirlatmalar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Hatırlatmalar"
      description="Duruşma, teslim ve takip gerektiren tüm işleri doğru zamanda görün ve tamamlayın."
      singular="hatırlatma"
      icon={BellRing}
      accent="amber"
      filterOptions={["Tümü", "Duruşma", "Toplantı", "Tahsilat", "Evrak teslimi"]}
      formFields={[
        {
          name: "title",
          label: "Hatırlatma başlığı",
          placeholder: "Örn. Duruşma – 2026/128",
          required: true,
          fullWidth: true,
        },
        {
          name: "subtitle",
          label: "İlgili dosya",
          type: "select",
          options: caseOptions,
          required: true,
        },
        { name: "meta", label: "Hatırlatma tarihi", type: "date", required: true },
        { name: "client", label: "Müvekkil", type: "select", options: clientOptions },
        {
          name: "reminderType",
          label: "Hatırlatma türü",
          type: "select",
          options: ["Duruşma", "Evrak teslimi", "Müvekkili ara", "Tahsilat", "Toplantı", "Diğer"],
        },
        {
          name: "status",
          label: "Hatırlatma durumu",
          type: "select",
          options: ["Duruşma", "Toplantı", "Tahsilat", "Evrak teslimi", "Tamamlandı"],
          required: true,
        },
        {
          name: "note",
          label: "Not",
          type: "textarea",
          placeholder: "Hatırlatma notu",
          fullWidth: true,
        },
      ]}
      stats={[
        { label: "Bugün", value: "4", note: "2'si öncelikli" },
        { label: "Bu hafta", value: "17", note: "Takvimde planlı" },
        { label: "Tamamlanan", value: "38", note: "Bu ay" },
      ]}
      rows={[
        {
          title: "İstanbul 3. Asliye Hukuk – Duruşma",
          subtitle: "2026/128 • Ayşe Demir",
          meta: "29 Temmuz 2026 • 10:30",
          status: "Duruşma",
        },
        {
          title: "Sözleşme toplantısı",
          subtitle: "2026/109 • Kaya Holding A.Ş.",
          meta: "30 Temmuz 2026 • 14:00",
          status: "Toplantı",
        },
        {
          title: "Tahsilat hatırlatması",
          subtitle: "2026/128 • Ayşe Demir",
          meta: "31 Temmuz 2026 • 09:00",
          status: "Tahsilat",
        },
        {
          title: "Bilirkişi raporu teslimi",
          subtitle: "2026/126 • Kaya Holding A.Ş.",
          meta: "04 Ağustos 2026 • 17:00",
          status: "Evrak teslimi",
        },
      ]}
    />
  );
}
