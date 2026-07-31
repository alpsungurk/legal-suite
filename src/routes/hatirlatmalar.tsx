import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { buildReminderFormFields } from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

export const Route = createFileRoute("/hatirlatmalar")({ component: Page });

function Page() {
  const {
    state,
    currentUser,
    findCase,
    findClient,
    findUser,
    caseOptions,
    clientOptions,
    userOptions,
    caseIdByLabel,
    clientIdByName,
    userIdByName,
    caseLabel,
    upsertReminder,
    deleteReminder,
    permissions,
  } = useErp();
  const [scope, setScope] = useState<"mine" | "all">("mine");

  const list =
    scope === "mine"
      ? state.reminders.filter((r) => r.assigneeId === currentUser.id)
      : state.reminders;

  return (
    <ManagementPage
      title="Hatırlatmalar"
      description="Duruşma, teslim ve takip gerektiren tüm işleri kişi bazlı atayın ve tamamlayın."
      singular="hatırlatma"
      icon={BellRing}
      accent="amber"
      columns={[
        { key: "title", label: "Başlık" },
        { key: "caseNo", label: "Dosya" },
        { key: "client", label: "Müvekkil", filterable: true },
        { key: "assignee", label: "Atanan kişi", filterable: true },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: state.reminderTypes,
        },
        { key: "date", label: "Tarih" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Beklemede", "Tamamlandı"],
        },
      ]}
      formFields={buildReminderFormFields({
        caseOptions,
        clientOptions,
        userOptions,
        reminderTypes: state.reminderTypes,
      })}
      canCreate={permissions.canWrite}
      canEdit={permissions.canWrite}
      canDelete={permissions.canDelete}
      externalFilters={
        <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
          <SelectTrigger className="h-10 w-full bg-background md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">Bana atanan</SelectItem>
            <SelectItem value="all">Tümü</SelectItem>
          </SelectContent>
        </Select>
      }
      stats={[
        {
          label: "Bana atanan",
          value: String(state.reminders.filter((r) => r.assigneeId === currentUser.id).length),
          note: currentUser.name,
        },
        {
          label: "Bekleyen",
          value: String(list.filter((r) => r.status === "Beklemede").length),
          note: "Açık hatırlatma",
        },
        {
          label: "Tamamlanan",
          value: String(list.filter((r) => r.status === "Tamamlandı").length),
          note: "Kapatılan",
        },
      ]}
      emptyCreateValues={{
        status: "Beklemede",
        type: state.reminderTypes[0] ?? "Duruşma",
        assigneeName: currentUser.name,
        date: new Date().toISOString().slice(0, 10),
      }}
      rows={list.map((r) => {
        const item = findCase(r.caseId);
        return {
          id: r.id,
          title: r.title,
          caseNo: item ? caseLabel(item) : "—",
          client: r.clientId
            ? (findClient(r.clientId)?.name ?? "—")
            : item
              ? (findClient(item.clientId)?.name ?? "—")
              : "—",
          assignee: findUser(r.assigneeId)?.name ?? "—",
          type: r.type,
          date: r.date,
          status: r.status,
        };
      })}
      getEditValues={(row) => {
        const r = state.reminders.find((x) => x.id === row.id);
        const item = r ? findCase(r.caseId) : undefined;
        return {
          title: r?.title ?? "",
          caseLabel: item ? caseLabel(item) : "",
          date: r?.date ?? "",
          clientName: r?.clientId ? (findClient(r.clientId)?.name ?? "") : "",
          assigneeName: findUser(r?.assigneeId ?? "")?.name ?? "",
          type: r?.type ?? "",
          status: r?.status ?? "Beklemede",
          note: r?.note ?? "",
        };
      }}
      onSave={(data, editingId) => {
        const caseId = caseIdByLabel(data.caseLabel);
        const assigneeId = userIdByName(data.assigneeName);
        if (!caseId || !assigneeId) {
          toast.error("Dosya veya atanan kişi geçersiz");
          return;
        }
        upsertReminder({
          id: editingId ?? undefined,
          title: data.title,
          caseId,
          date: data.date,
          clientId: clientIdByName(data.clientName),
          assigneeId,
          type: data.type,
          status: data.status,
          note: data.note,
        });
        toast.success(editingId ? "Hatırlatma güncellendi" : "Yeni hatırlatma eklendi");
      }}
      onDelete={(id) => {
        deleteReminder(id);
        toast.success("Hatırlatma silindi");
      }}
    />
  );
}
