import { useMemo, useState } from "react";
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
import { MultiCombobox, Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { CaseTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { addDays, formatDate, today } from "@/lib/format";
import {
  APPEAL_CASE_STATUSES,
  CASE_LISTS,
  LOCKED_CASE_TYPES,
  OTHER_CASE_LIST,
  isHearingType,
} from "@/lib/erp-types";

const norm = (s?: string) => (s ?? "").toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();

/** ?tur=Hukuk | Ceza | İdare | diger: yan menüdeki ayrı listeler bu adresle açılır */
type Search = { tur?: string };

function listHeading(tur?: string) {
  return (
    CASE_LISTS.find((l) => l.tur === tur)?.label ??
    (tur === OTHER_CASE_LIST.tur ? OTHER_CASE_LIST.label : "Dosyalar")
  );
}

export const Route = createFileRoute("/dosyalar/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tur: typeof s.tur === "string" ? s.tur : undefined,
  }),
  head: ({ match }) => ({
    meta: [{ title: `${listHeading(match.search.tur)} — Avukat Yönetim Paneli` }],
  }),
  component: Page,
});

function Page() {
  const { state, currentUser, permissions } = useErp();
  const quick = useQuick();
  const navigate = useNavigate();
  const [scope, setScope] = useState(currentUser.role === "Avukat" ? "mine" : "all");
  const [view, setView] = useState("open");
  // Hukuk / Ceza / İdare sekmesi (adreste ?tur=); "other": bu üçü dışındaki türler
  const { tur } = Route.useSearch();
  const kind = tur === "diger" ? "other" : tur && LOCKED_CASE_TYPES.includes(tur) ? tur : "all";
  const setKind = (k: string) =>
    navigate({
      to: "/dosyalar",
      search: k === "all" ? {} : { tur: k === "other" ? "diger" : k },
      replace: true,
    });
  // Birden çok müvekkil birlikte: ör. şirket ve ortakları; Excel'e aktarım da bu süzgeçle
  const [clientIds, setClientIds] = useState<string[]>([]);

  const ofKind = (type: string) =>
    kind === "all" || (kind === "other" ? !LOCKED_CASE_TYPES.includes(type) : type === kind);
  // Müvekkil dosyanın müvekkiliyse ya da aynı dosyada geçen diğer müvekkillerdense (not)
  const selectedNames = clientIds
    .map((id) => state.clients.find((c) => c.id === id)?.name)
    .filter((n): n is string => !!n)
    .map(norm);
  const ofClients = (c: (typeof state.cases)[number]) =>
    !clientIds.length ||
    (!!c.clientId && clientIds.includes(c.clientId)) ||
    selectedNames.some((n) => norm(c.note).includes(n));

  const rows = state.cases.filter(
    (c) =>
      (scope === "all" || c.responsibleIds.includes(currentUser.id)) &&
      (view === "all" || (view === "open" ? c.status !== "Kapalı" : c.status === "Kapalı")) &&
      ofKind(c.type) &&
      ofClients(c),
  );
  const kindCount = (k: string) =>
    state.cases.filter((c) => (k === "other" ? !LOCKED_CASE_TYPES.includes(c.type) : c.type === k))
      .length;
  const listMeta =
    CASE_LISTS.find((l) => l.tur === kind) ??
    (kind === "other"
      ? OTHER_CASE_LIST
      : {
          label: "Dosyalar",
          description: "Hukuk, ceza ve idare dosyaları; danışmanlık ve arabuluculuk",
        });
  // Süzgeç için yalnızca dosyası olan müvekkiller
  const clientOptions = useMemo(() => {
    const withCases = new Set(state.cases.map((c) => c.clientId).filter(Boolean));
    return state.clients
      .filter((c) => withCases.has(c.id))
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [state.cases, state.clients]);
  const exportName = [
    "Dosyalar",
    kind === "all" ? "" : kind === "other" ? "Diğer" : kind,
    clientIds.length
      ? clientIds.map((id) => state.clients.find((c) => c.id === id)?.name).join(", ")
      : "",
  ]
    .filter(Boolean)
    .join(" - ");
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
  // Liste değişince (Hukuk → Ceza…) sayfa yeniden açılış animasyonu oynasın
  return (
    <PageShell key={kind}>
      <PageHeader
        title={listMeta.label}
        description={listMeta.description}
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
                    ...(LOCKED_CASE_TYPES.includes(kind) ? { preset: { type: kind } } : {}),
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
          value={APPEAL_CASE_STATUSES.reduce((n, st) => n + count(st), 0)}
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
      <Segmented
        className="w-full overflow-x-auto sm:w-auto"
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: `Tümü (${state.cases.length})` },
          ...LOCKED_CASE_TYPES.map((t) => ({ value: t, label: `${t} (${kindCount(t)})` })),
          { value: "other", label: `Diğer (${kindCount("other")})` },
        ]}
      />
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
        <div className="w-full sm:w-80">
          <MultiCombobox
            value={clientIds}
            onChange={setClientIds}
            options={clientOptions}
            placeholder="Müvekkillere göre süz (birden çok seçilebilir)"
          />
        </div>
      </div>
      <CaseTable rows={rows} exportName={exportName} />
    </PageShell>
  );
}
