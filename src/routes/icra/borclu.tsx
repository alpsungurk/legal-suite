import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { EnforcementList, EnforcementPageActions } from "@/components/lists/EnforcementList";

export const Route = createFileRoute("/icra/borclu")({
  head: () => ({ meta: [{ title: "Borçlu olduğumuz dosyalar — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const { permissions } = useErp();
  if (!permissions.can("enforcements")) return <NoAccess />;
  return (
    <PageShell>
      <PageHeader
        title="Borçlu olduğumuz dosyalar"
        description="Müvekkilimizin borçlu olduğu icra takipleri. Tahsilat ve ödeme sözü bu dosyalarda tutulmaz."
        icon={Scale}
        actions={<EnforcementPageActions side="Borçlu" />}
      />
      <EnforcementList side="Borçlu" exportName="Borçlu olduğumuz dosyalar" />
    </PageShell>
  );
}
