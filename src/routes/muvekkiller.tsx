import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildClientFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/muvekkiller")({ component: Page });

function Page() {
  const { state, upsertClient, deleteClient, permissions } = useErp();
  const activeCount = state.clients.filter((c) => c.status === "Aktif").length;

  return (
    <ManagementPage
      title="Müvekkiller"
      description="Kişi ve kurum müvekkillerinizin dosya, iletişim ve cari durumunu tek ekrandan takip edin."
      singular="müvekkil"
      icon={Users}
      accent="blue"
      columns={[
        { key: "name", label: "Ad Soyad / Firma" },
        { key: "kind", label: "Tür", filterable: true },
        { key: "email", label: "E-posta" },
        { key: "phone", label: "Telefon" },
        { key: "status", label: "Durum", filterable: true, filterOptions: ["Aktif", "Pasif"] },
      ]}
      formFields={buildClientFormFields()}
      canCreate={permissions.canWrite}
      canEdit={permissions.canWrite}
      canDelete={permissions.canDelete}
      stats={[
        { label: "Toplam müvekkil", value: String(state.clients.length), note: "Kayıtlı" },
        {
          label: "Aktif müvekkil",
          value: String(activeCount),
          note: `%${state.clients.length ? Math.round((activeCount / state.clients.length) * 100) : 0} aktif`,
        },
        {
          label: "Pasif müvekkil",
          value: String(state.clients.length - activeCount),
          note: "Arşiv",
        },
      ]}
      emptyCreateValues={{ status: "Aktif", kind: "Bireysel" }}
      rows={state.clients.map((client) => ({
        id: client.id,
        name: client.name,
        kind: client.kind,
        email: client.email,
        phone: client.phone,
        status: client.status,
      }))}
      getEditValues={(row) => {
        const client = state.clients.find((c) => c.id === row.id);
        return {
          name: client?.name ?? "",
          email: client?.email ?? "",
          phone: client?.phone ?? "",
          kind: client?.kind ?? "Bireysel",
          identity: client?.identity ?? "",
          address: client?.address ?? "",
          status: client?.status ?? "Aktif",
        };
      }}
      onSave={(data, editingId) => {
        upsertClient({
          id: editingId ?? undefined,
          name: data.name,
          email: data.email,
          phone: data.phone,
          kind: (data.kind as "Bireysel" | "Kurumsal") || "Bireysel",
          identity: data.identity,
          address: data.address,
          status: data.status === "Pasif" ? "Pasif" : "Aktif",
        });
        toast.success(editingId ? "Müvekkil güncellendi" : "Yeni müvekkil eklendi");
      }}
      onDelete={(id) => {
        deleteClient(id);
        toast.success("Müvekkil silindi");
      }}
    />
  );
}
