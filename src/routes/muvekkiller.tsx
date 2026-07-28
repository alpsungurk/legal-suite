import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { clients } from "@/lib/erp-data";
import { clientFormFields } from "@/lib/management-form-config";

export const Route = createFileRoute("/muvekkiller")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Müvekkiller"
      description="Kişi ve kurum müvekkillerinizin dosya, iletişim ve cari durumunu tek ekrandan takip edin."
      singular="müvekkil"
      icon={Users}
      accent="blue"
      filterOptions={["Tümü", "Aktif", "İncelemede"]}
      formFields={clientFormFields}
      stats={[
        { label: "Toplam müvekkil", value: "342", note: "+8 bu ay" },
        { label: "Aktif müvekkil", value: "287", note: "%84 aktif" },
        { label: "Yeni kayıt", value: "12", note: "Son 30 gün" },
      ]}
      rows={clients.slice(0, 4).map((client) => ({
        title: client.name,
        subtitle: `${client.kind} • ${client.email}`,
        meta: `${client.activeCases} aktif dosya • ${client.phone}`,
        status: client.name === "Kaya Holding A.Ş." ? "İncelemede" : "Aktif",
      }))}
    />
  );
}
