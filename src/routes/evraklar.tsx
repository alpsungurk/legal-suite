import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { caseOptions, clientOptions, documents, findCase, findClient } from "@/lib/erp-data";
import { documentFormFields } from "@/lib/management-form-config";

export const Route = createFileRoute("/evraklar")({ component: Page });
function Page() {
  return (
    <ManagementPage
      title="Evrak Merkezi"
      description="PDF, görsel ve ofis belgelerini güvenle saklayın; dosya ve müvekkillerle ilişkilendirin."
      singular="evrak"
      icon={FileText}
      accent="blue"
      filterOptions={["Tümü", "İmzalandı", "İnceleniyor", "Taslak"]}
      formFields={documentFormFields}
      allowRowExport
      rowExportLabel="Dilekçeyi dışa aktar"
      stats={[
        { label: "Toplam evrak", value: "1.248", note: "+36 bu ay" },
        { label: "Bu hafta yüklenen", value: "18", note: "5 dosyada" },
        { label: "İnceleme bekleyen", value: "7", note: "Öncelikli" },
      ]}
      rows={documents.map((document) => {
        const item = findCase(document.caseId);
        return {
          title: document.name,
          subtitle: `${document.type} • ${document.size} • ${item.no}`,
          meta: `${findClient(item.clientId).name} • ${document.date}`,
          status: document.status,
        };
      })}
    />
  );
}
