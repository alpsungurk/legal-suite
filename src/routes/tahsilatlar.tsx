import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FeesWorkspace, validateFeesSearch } from "@/components/fees/FeesWorkspace";

export const Route = createFileRoute("/tahsilatlar")({
  validateSearch: validateFeesSearch,
  head: () => ({ meta: [{ title: "Tahsilatlar — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { sekme } = Route.useSearch();
  return (
    <FeesWorkspace
      adminOnly={false}
      sekme={sekme}
      onTab={(t) => navigate({ to: "/tahsilatlar", search: { sekme: t }, replace: true })}
    />
  );
}
