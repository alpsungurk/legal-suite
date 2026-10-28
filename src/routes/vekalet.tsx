/** Vekalet ücreti: yalnızca yöneticinin gördüğü ücret planları (menüde yok; gösterge panelinden açılır) */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FeesWorkspace, validateFeesSearch } from "@/components/fees/FeesWorkspace";

export const Route = createFileRoute("/vekalet")({
  validateSearch: validateFeesSearch,
  head: () => ({ meta: [{ title: "Vekalet ücreti — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { sekme } = Route.useSearch();
  return (
    <FeesWorkspace
      adminOnly
      sekme={sekme}
      onTab={(t) => navigate({ to: "/vekalet", search: { sekme: t }, replace: true })}
    />
  );
}
