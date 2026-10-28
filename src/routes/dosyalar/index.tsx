import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarClock,
  FileSpreadsheet,
  FolderKanban,
  FolderOpen,
  Plus,
  Scale,
  Undo2,
} from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell, NoAccess } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { CaseTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { addDays, formatDate, today } from "@/lib/format";
import { isHearingType } from "@/lib/erp-types";

export const Route = createFileRoute("/dosyalar/")({
  head: () => ({ meta: [{ title: "Dosyalar — Avukat Yönetim Paneli" }] }),
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
  // Duruşma ve keşifler (haftalık duruşma listesiyle aynı), en yakını önce
  const hearings = state.reminders
    .filter(
      (r) =>
        isHearingType(r.type) && r.status === "Bekliyor" && r.date >= today() && r.date <= weekEnd,
    )
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
  const next = hearings[0];
  const count = (status: string) => state.cases.filter((c) => c.status === status).length;

  if (!permissions.can("cases")) return <NoAccess />;
  return (
    <PageShell>
      <PageHeader
        title="Dosyalar"
        description="Dava, icra, danışmanlık ve arabuluculuk dosyaları"
        icon={FolderKanban}
        actions={
          permissions.can("cases", "create") && (
            <>
              <Button variant="outline" onClick={() => quick.open("import", { kind: "cases" })}>
                <FileSpreadsheet /> Excel ile aktar
              </Button>
              <Button
                onClick={() =>
                  quick.open("case", {
                    onSaved: (c) => navigate({ to: "/dosyalar/$id", params: { id: c.id } }),
                  })
                }
              >
                <Plus /> Yeni dosya
              </Button>
            </>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Açık dosya"
          value={open.length}
          icon={FolderOpen}
          tone="blue"
          hint={`Kapalı olmayan dosyalar · ${state.cases.length} toplam`}
        />
        <StatTile
          label="Derdest"
          value={count("Derdest")}
          icon={Scale}
          tone="violet"
          hint="Görülmekte olan davalar"
        />
        <StatTile
          label="Kanun yolunda"
          value={count("Kanun yolu")}
          icon={Undo2}
          tone="amber"
          hint="İstinaf ya da temyiz aşamasında"
        />
        <StatTile
          label="Bu hafta duruşma"
          value={hearings.length}
          icon={CalendarClock}
          tone="green"
          to="/takvim"
          hint={
            next
              ? `Sıradaki: ${formatDate(next.date)}${next.time ? ` ${next.time}` : ""}${next.location ? ` · ${next.location}` : ""}`
              : "Önümüzdeki 7 günde duruşma yok"
          }
        />
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
