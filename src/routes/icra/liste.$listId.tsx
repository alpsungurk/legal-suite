import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building, Settings } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnforcementList, EnforcementPageActions } from "@/components/lists/EnforcementList";
import { listIcon } from "@/lib/list-icons";

type Search = { taraf?: "alacakli" | "borclu" };

export const Route = createFileRoute("/icra/liste/$listId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    taraf: s.taraf === "borclu" ? "borclu" : undefined,
  }),
  head: () => ({ meta: [{ title: "Şirket listesi — Avukat Yönetim Paneli" }] }),
  component: Page,
});

/** Ayarlar → Şirket listeleri'nde tanımlanan müvekkillerin icra dosyaları */
function Page() {
  const { state, permissions } = useErp();
  const { listId } = Route.useParams();
  const { taraf } = Route.useSearch();
  const navigate = useNavigate();
  const list = state.settings.companyLists.find((l) => l.id === listId);
  if (!permissions.can("enforcements")) return <NoAccess />;
  if (!list)
    return (
      <PageShell>
        <EmptyState
          icon={Building}
          title="Liste bulunamadı"
          description="Liste silinmiş olabilir. Şirket listeleri Ayarlar'dan yönetilir."
        />
      </PageShell>
    );
  const names = list.clientIds
    .map((id) => state.clients.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const owedCount = state.enforcements.filter(
    (e) => e.side === "Borçlu" && list.clientIds.includes(e.clientId),
  ).length;
  const tab = taraf === "borclu" ? "borclu" : "alacakli";
  return (
    <PageShell>
      <PageHeader
        title={list.name}
        description={names || "Bu listeye henüz müvekkil eklenmedi"}
        icon={listIcon(list.icon)}
        actions={
          <>
            {permissions.settingsAccess.companies.view && (
              <Button variant="outline" asChild>
                <Link to="/ayarlar" search={{ sekme: "sirketler" }}>
                  <Settings /> Listeyi düzenle
                </Link>
              </Button>
            )}
            {/* Listede tek şirket varsa yeni takip doğrudan o şirkete açılır */}
            <EnforcementPageActions
              side={tab === "borclu" ? "Borçlu" : "Alacaklı"}
              clientId={list.clientIds.length === 1 ? list.clientIds[0] : undefined}
            />
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(t) =>
          navigate({
            to: "/icra/liste/$listId",
            params: { listId },
            search: { taraf: t === "borclu" ? "borclu" : undefined },
            replace: true,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="alacakli">Alacaklı olduğumuz</TabsTrigger>
          <TabsTrigger value="borclu">Borçlu olduğumuz{owedCount ? ` (${owedCount})` : ""}</TabsTrigger>
        </TabsList>
        <TabsContent value="alacakli" className="mt-4 space-y-4">
          <EnforcementList
            side="Alacaklı"
            clientIds={list.clientIds}
            exportName={`${list.name} - alacaklı olduğumuz`}
          />
        </TabsContent>
        <TabsContent value="borclu" className="mt-4 space-y-4">
          <EnforcementList
            side="Borçlu"
            clientIds={list.clientIds}
            exportName={`${list.name} - borçlu olduğumuz`}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
