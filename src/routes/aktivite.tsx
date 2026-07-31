import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/aktivite")({ component: Page });

function Page() {
  const { state, findUser } = useErp();

  return (
    <ManagementPage
      title="Aktivite Geçmişi"
      description="Büroda yapılan tüm kayıt, güncelleme ve finansal işlemleri izleyin."
      singular="aktivite"
      icon={History}
      accent="violet"
      readOnly
      columns={[
        { key: "action", label: "İşlem" },
        {
          key: "entity",
          label: "Tür",
          filterable: true,
        },
        { key: "actor", label: "Kullanıcı", filterable: true },
        { key: "detail", label: "Detay" },
        { key: "amount", label: "Tutar" },
        { key: "timestamp", label: "Zaman" },
      ]}
      stats={[
        {
          label: "Toplam kayıt",
          value: String(state.activities.length),
          note: "İzlenebilir",
        },
        {
          label: "Bugün",
          value: String(
            state.activities.filter(
              (a) => a.timestamp.slice(0, 10) === new Date().toISOString().slice(0, 10),
            ).length,
          ),
          note: "Güncel hareket",
        },
        {
          label: "Kullanıcı",
          value: String(new Set(state.activities.map((a) => a.actorId)).size),
          note: "Aktör",
        },
      ]}
      rows={state.activities.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        actor: findUser(a.actorId)?.name ?? "—",
        detail: a.detail,
        amount: a.amount ?? "—",
        timestamp: new Date(a.timestamp).toLocaleString("tr-TR"),
      }))}
    />
  );
}
