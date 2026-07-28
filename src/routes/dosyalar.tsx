import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { cases, clientOptions, findClient, findLawyer, lawyerOptions } from "@/lib/erp-data";
import { caseFormFields } from "@/lib/management-form-config";

export const Route = createFileRoute("/dosyalar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Dava Dosyaları"
      description="Dava süreçlerini, mahkeme bilgilerini, sorumlu avukatları ve dosya geçmişini kontrol altında tutun."
      singular="dosya"
      icon={FolderKanban}
      accent="violet"
      filterOptions={["Tümü", "Tebligat", "Ön inceleme", "Delil toplama", "Duruşma"]}
      formFields={caseFormFields}
      stats={[
        { label: "Aktif dosya", value: "128", note: "+3 bu ay" },
        { label: "Kapalı dosya", value: "86", note: "2026 yılı" },
        { label: "Duruşması yaklaşan", value: "9", note: "Önümüzdeki 7 gün" },
      ]}
      rows={cases.slice(0, 4).map((item) => ({
        title: `${item.no} • ${item.title}`,
        subtitle: `${findClient(item.clientId).name} • ${item.court}`,
        meta: `Sorumlu: ${findLawyer(item.responsibleId).name} • Açılış: ${item.openingDate}`,
        status: item.stage,
      }))}
    />
  );
}
