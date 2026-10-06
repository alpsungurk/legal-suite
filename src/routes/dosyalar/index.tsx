import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { CaseTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { addDays, today } from "@/lib/format";

export const Route = createFileRoute("/dosyalar/")({
  head: () => ({ meta: [{ title: "Dosyalar — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, currentUser, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  const [scope, setScope] = useState(currentUser.role === "Avukat" ? "mine" : "all");
  const [view, setView] = useState("open");

  const rows = state.cases.filter(
    (c) =>
      (scope === "all" || c.responsibleIds.includes(currentUser.id)) &&
      (view === "all" || (view === "open" ? c.status !== "Kapalı" : c.status === "Kapalı")),
  );
  const open = state.cases.filter((c) => c.status !== "Kapalı");
  const weekEnd = addDays(today(), 7);
  const hearings = state.reminders.filter(
    (r) =>
      r.type === "Duruşma" && r.status === "Bekliyor" && r.date >= today() && r.date <= weekEnd,
  );

  return (
    <PageShell>
      <PageHeader
        title="Dosyalar"
        description="Dava, icra, danışmanlık ve arabuluculuk dosyaları"
        icon={FolderKanban}
        actions={
          permissions.manageRecords && (
            <Button
              onClick={() =>
                quick.open("case", {
                  onSaved: (c) => navigate({ to: "/dosyalar/$id", params: { id: c.id } }),
                })
              }
            >
              <Plus /> Yeni dosya
            </Button>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Açık dosya"
          value={open.length}
          tone="blue"
          hint={`${state.cases.length} toplam`}
        />
        <StatTile
          label="Derdest"
          value={state.cases.filter((c) => c.status === "Derdest").length}
          tone="violet"
        />
        <StatTile
          label="Kanun yolunda"
          value={state.cases.filter((c) => c.status === "Kanun yolu").length}
          tone="amber"
        />
        <StatTile label="Bu hafta duruşma" value={hearings.length} tone="green" to="/takvim" />
      </StatGrid>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          className="w-auto"
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "Benim dosyalarım" },
            { value: "all", label: "Tüm dosyalar" },
          ]}
        />
        <Segmented
          className="w-auto"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: "Açık" },
            { value: "closed", label: "Kapalı" },
            { value: "all", label: "Tümü" },
          ]}
        />
      </div>
      <CaseTable rows={rows} />
    </PageShell>
  );
}
