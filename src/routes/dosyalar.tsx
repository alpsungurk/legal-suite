import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildCaseFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

type Search = { tur?: string };

export const Route = createFileRoute("/dosyalar")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tur: typeof search.tur === "string" ? search.tur : undefined,
  }),
  component: Page,
});

function Page() {
  const { tur } = Route.useSearch();
  const { state, findClient, clientOptions, clientIdByName, upsertCase, deleteCase, permissions } =
    useErp();

  const filtered = tur ? state.cases.filter((c) => c.type === tur) : state.cases;
  const active = state.cases.length;

  return (
    <ManagementPage
      title={tur ? `Dosyalar — ${tur}` : "Dava Dosyaları"}
      description="Dava süreçlerini ve mahkeme bilgilerini tek ekranda takip edin."
      singular="dosya"
      icon={FolderKanban}
      accent="violet"
      searchPlaceholder="Dosya no, müvekkil adı veya mahkeme ara..."
      columns={[
        { key: "no", label: "Dosya No" },
        { key: "title", label: "Dosya Adı" },
        { key: "client", label: "Müvekkil", filterable: true },
        { key: "court", label: "Mahkeme" },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: state.caseTypes,
        },
        { key: "openingDate", label: "Açılış" },
      ]}
      formFields={buildCaseFormFields({
        clientOptions,
        lawyerOptions: [],
        caseTypes: state.caseTypes,
      })}
      canCreate={permissions.canCreateCases}
      canEdit={permissions.canManageRecords}
      canDelete={permissions.canDelete}
      stats={[
        { label: "Toplam dosya", value: String(active), note: "Kayıtlı dosyalar" },
        {
          label: "Arabuluculuk",
          value: String(state.cases.filter((item) => item.type === "Arabuluculuk").length),
          note: "Kayıtlı dosya",
        },
        {
          label: tur ? `${tur} dosya` : "Toplam",
          value: String(filtered.length),
          note: tur ? "Filtrelenmiş" : "Tüm türler",
        },
      ]}
      emptyCreateValues={{
        type: tur ?? state.caseTypes[0] ?? "Dava",
        openingDate: new Date().toISOString().slice(0, 10),
      }}
      rows={filtered.map((item) => ({
        id: item.id,
        no: item.no,
        title: item.title,
        client: findClient(item.clientId ?? "")?.name ?? "—",
        court: item.court ?? "—",
        type: item.type,
        openingDate: item.openingDate,
        note: item.note ?? "—",
      }))}
      getEditValues={(row) => {
        const item = state.cases.find((c) => c.id === row.id);
        return {
          no: item?.no ?? "",
          title: item?.title ?? "",
          clientName: findClient(item?.clientId ?? "")?.name ?? "",
          court: item?.court ?? "",
          type: item?.type ?? "",
          openingDate: item?.openingDate ?? "",
          note: item?.note ?? "",
        };
      }}
      onSave={(data, editingId) => {
        const clientId = clientIdByName(data.clientName);
        if (!clientId) {
          toast.error("Müvekkil seçimi geçersiz");
          return;
        }
        upsertCase({
          id: editingId ?? undefined,
          no: data.no,
          title: data.title,
          clientId,
          court: data.court,
          type: data.type,
          openingDate: data.openingDate,
          note: data.note,
        });
        toast.success(editingId ? "Dosya güncellendi" : "Yeni dosya eklendi");
      }}
      onDelete={(id) => {
        deleteCase(id);
        toast.success("Dosya silindi");
      }}
    />
  );
}
