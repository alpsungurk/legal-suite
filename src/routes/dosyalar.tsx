import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildCaseFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";
import { CASE_STAGES } from "@/lib/erp-types";

type Search = { tur?: string };

export const Route = createFileRoute("/dosyalar")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tur: typeof search.tur === "string" ? search.tur : undefined,
  }),
  component: Page,
});

function Page() {
  const { tur } = Route.useSearch();
  const {
    state,
    findClient,
    findUser,
    clientOptions,
    userOptions,
    clientIdByName,
    userIdByName,
    upsertCase,
    deleteCase,
    permissions,
  } = useErp();

  const filtered = tur ? state.cases.filter((c) => c.type === tur) : state.cases;
  const active = state.cases.filter((c) => c.stage !== "Kapalı").length;

  return (
    <ManagementPage
      title={tur ? `Dosyalar — ${tur}` : "Dava Dosyaları"}
      description="Dava süreçlerini, mahkeme bilgilerini, sorumlu avukatları ve dosya geçmişini kontrol altında tutun."
      singular="dosya"
      icon={FolderKanban}
      accent="violet"
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
        { key: "responsible", label: "Sorumlu", filterable: true },
        { key: "openingDate", label: "Açılış" },
        {
          key: "stage",
          label: "Aşama",
          filterable: true,
          filterOptions: [...CASE_STAGES],
        },
      ]}
      formFields={buildCaseFormFields({
        clientOptions,
        lawyerOptions: userOptions,
        caseTypes: state.caseTypes,
      })}
      canCreate={permissions.canWrite}
      canEdit={permissions.canWrite}
      canDelete={permissions.canDelete}
      stats={[
        { label: "Aktif dosya", value: String(active), note: "Kapalı hariç" },
        {
          label: "Kapalı dosya",
          value: String(state.cases.length - active),
          note: "Arşiv",
        },
        {
          label: tur ? `${tur} dosya` : "Toplam",
          value: String(filtered.length),
          note: tur ? "Filtrelenmiş" : "Tüm türler",
        },
      ]}
      emptyCreateValues={{
        stage: "Tebligat",
        type: tur ?? state.caseTypes[0] ?? "Dava",
        openingDate: new Date().toISOString().slice(0, 10),
      }}
      rows={filtered.map((item) => ({
        id: item.id,
        no: item.no,
        title: item.title,
        client: findClient(item.clientId)?.name ?? "—",
        court: item.court,
        type: item.type,
        responsible: findUser(item.responsibleId)?.name ?? "—",
        openingDate: item.openingDate,
        stage: item.stage,
      }))}
      getEditValues={(row) => {
        const item = state.cases.find((c) => c.id === row.id);
        return {
          no: item?.no ?? "",
          title: item?.title ?? "",
          clientName: findClient(item?.clientId ?? "")?.name ?? "",
          court: item?.court ?? "",
          type: item?.type ?? "",
          responsibleName: findUser(item?.responsibleId ?? "")?.name ?? "",
          openingDate: item?.openingDate ?? "",
          stage: item?.stage ?? "Tebligat",
          note: item?.note ?? "",
        };
      }}
      onSave={(data, editingId) => {
        const clientId = clientIdByName(data.clientName);
        const responsibleId = userIdByName(data.responsibleName);
        if (!clientId || !responsibleId) {
          toast.error("Müvekkil veya sorumlu seçimi geçersiz");
          return;
        }
        upsertCase({
          id: editingId ?? undefined,
          no: data.no,
          title: data.title,
          clientId,
          court: data.court,
          type: data.type,
          responsibleId,
          openingDate: data.openingDate,
          stage: data.stage,
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
