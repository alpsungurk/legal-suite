import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Upload } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { formatBytes, sumBy } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell, NoAccess } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Button } from "@/components/ui/button";
import { DocumentTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";

export const Route = createFileRoute("/belgeler")({
  head: () => ({ meta: [{ title: "Belgeler — LexKasa" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const docBytes = sumBy(state.documents, (d) => d.attachment.size);

  if (!permissions.can("documents")) return <NoAccess />;
  return (
    <PageShell>
      <PageHeader
        title="Belgeler"
        description="Dosya ve müvekkil belgeleri"
        icon={FolderOpen}
        actions={
          permissions.can("documents", "create") && (
            <Button onClick={() => quick.open("document")}>
              <Upload /> Belge yükle
            </Button>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Belge"
          value={state.documents.length}
          icon={FolderOpen}
          tone="blue"
          hint={formatBytes(docBytes)}
        />
      </StatGrid>
      <DocumentTable rows={state.documents} />
    </PageShell>
  );
}
