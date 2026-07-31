import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/bildirimler")({ component: Page });

function Page() {
  const { state, currentUser, markNotificationRead, markAllNotificationsRead } = useErp();
  const mine = state.notifications.filter((n) => n.userId === currentUser.id);
  const unread = mine.filter((n) => !n.read);

  return (
    <ManagementPage
      title="Bildirim Merkezi"
      description="Size atanan işlem, tahsilat, masraf ve hatırlatma bildirimlerini takip edin."
      singular="bildirim"
      icon={Bell}
      accent="violet"
      readOnly
      columns={[
        { key: "title", label: "Başlık" },
        { key: "detail", label: "Detay" },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: ["Tahsilat", "Masraf", "Hatırlatma", "Dosya", "Önemli"],
        },
        { key: "createdAt", label: "Zaman" },
        {
          key: "readStatus",
          label: "Durum",
          filterable: true,
          filterOptions: ["Okunmadı", "Okundu"],
        },
      ]}
      stats={[
        { label: "Okunmamış", value: String(unread.length), note: "İşlem bekliyor" },
        { label: "Toplam", value: String(mine.length), note: "Size ait" },
        {
          label: "Bugün",
          value: String(
            mine.filter((n) => n.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
              .length,
          ),
          note: "Güncel",
        },
      ]}
      rows={mine.map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.detail,
        type: n.type,
        createdAt: new Date(n.createdAt).toLocaleString("tr-TR"),
        readStatus: n.read ? "Okundu" : "Okunmadı",
      }))}
      onRowClick={(row) => {
        markNotificationRead(row.id);
        if (unread.length > 0) toast.message("Bildirim okundu olarak işaretlendi");
      }}
      externalFilters={
        <button
          type="button"
          className="h-10 rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          onClick={() => {
            markAllNotificationsRead();
            toast.success("Tüm bildirimler okundu");
          }}
        >
          Tümünü okundu işaretle
        </button>
      }
    />
  );
}
