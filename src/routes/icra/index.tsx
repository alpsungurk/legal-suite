import { createFileRoute } from "@tanstack/react-router";
import { Gavel } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { EnforcementList, EnforcementPageActions } from "@/components/lists/EnforcementList";

export const Route = createFileRoute("/icra/")({
  head: () => ({ meta: [{ title: "Alacaklı olduğumuz dosyalar — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const { permissions } = useErp();
  if (!permissions.can("enforcements")) return <NoAccess />;
  return (
    <PageShell>
      <PageHeader
        title="Alacaklı olduğumuz dosyalar"
        description="Müvekkilimizin alacaklı olduğu icra takipleri, haciz süreleri, ödeme sözleri ve tahsilatlar"
        icon={Gavel}
        actions={<EnforcementPageActions side="Alacaklı" />}
      />
      <EnforcementList side="Alacaklı" exportName="Alacaklı olduğumuz dosyalar" />
    </PageShell>
  );
}
