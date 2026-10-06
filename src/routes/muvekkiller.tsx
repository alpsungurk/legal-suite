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
      searchPlaceholder="Müvekkil adı, e-posta veya telefon ara..."
      columns={[
        { key: "name", label: "Ad Soyad / Firma" },
        { key: "kind", label: "Tür", filterable: true },
        { key: "monthlyFee", label: "Aylık ücret" },
        { key: "monthlyFeeStartDate", label: "Ücret başlangıcı" },
        { key: "email", label: "E-posta" },
        { key: "phone", label: "Telefon" },
        { key: "status", label: "Durum", filterable: true, filterOptions: ["Aktif", "Pasif"] },
      ]}
      formFields={buildClientFormFields()}
      canCreate={permissions.canCreateClients}
      canEdit={permissions.canManageRecords}
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
        monthlyFee: client.monthlyFee ? `₺${client.monthlyFee.toLocaleString("tr-TR")}` : "—",
        monthlyFeeStartDate: client.monthlyFeeStartDate ?? "—",
        identity: client.identity ?? "—",
        address: client.address ?? "—",
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
          monthlyFee: String(client?.monthlyFee ?? "0"),
          monthlyFeeStartDate: client?.monthlyFeeStartDate ?? "",
          address: client?.address ?? "",
          status: client?.status ?? "Aktif",
        };
      }}
      onSave={(data, editingId) => {
        const monthlyFee = Number(data.monthlyFee) || 0;
        if (data.kind === "Kurumsal" && monthlyFee > 0 && !data.monthlyFeeStartDate) {
          toast.error("Aylık ücret takibi için başlangıç tarihi girin");
          return;
        }
        upsertClient({
          id: editingId ?? undefined,
          name: data.name,
          email: data.email,
          phone: data.phone,
          kind: (data.kind as "Bireysel" | "Kurumsal") || "Bireysel",
          identity: data.identity,
          monthlyFee,
          monthlyFeeStartDate:
            data.kind === "Kurumsal" && monthlyFee > 0 ? data.monthlyFeeStartDate : undefined,
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
