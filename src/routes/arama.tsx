import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";

type SearchParams = { q?: string };

export const Route = createFileRoute("/arama")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Page,
});

function Page() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate();
  const { searchAll } = useErp();
  const [liveQuery, setLiveQuery] = useState(q);

  useEffect(() => {
    setLiveQuery(q);
  }, [q]);

  const results = useMemo(() => searchAll(liveQuery), [searchAll, liveQuery]);

  return (
    <ManagementPage
      title="Global Arama"
      description="Müvekkil, dosya, masraf, tahsilat, hatırlatma ve kullanıcılarda tek ekrandan hızlı arama yapın."
      singular="sonuç"
      icon={Search}
      accent="blue"
      readOnly
      initialQuery={q}
      searchPlaceholder="Müvekkil, dosya no, telefon veya açıklama ara..."
      onSearchChange={(value) => {
        setLiveQuery(value);
        navigate({
          to: "/arama",
          search: value.trim() ? { q: value.trim() } : {},
          replace: true,
        });
      }}
      columns={[
        { key: "title", label: "Sonuç" },
        { key: "subtitle", label: "Detay" },
        {
          key: "type",
          label: "Tür",
          filterable: true,
          filterOptions: ["Müvekkil", "Dosya", "Masraf", "Tahsilat", "Hatırlatma", "Kullanıcı"],
        },
      ]}
      stats={[
        {
          label: "Sonuç",
          value: String(results.length),
          note: liveQuery ? `"${liveQuery}"` : "Arama yapın",
        },
        {
          label: "Dosya",
          value: String(results.filter((r) => r.type === "Dosya").length),
          note: "Eşleşen",
        },
        {
          label: "Müvekkil",
          value: String(results.filter((r) => r.type === "Müvekkil").length),
          note: "Eşleşen",
        },
      ]}
      rows={results.map((r) => ({
        id: `${r.type}-${r.id}`,
        title: r.title,
        subtitle: r.subtitle,
        type: r.type,
        href: r.href,
      }))}
      onRowClick={(row) => {
        const href = row.href;
        if (href === "/muvekkiller") navigate({ to: "/muvekkiller" });
        else if (href === "/dosyalar") navigate({ to: "/dosyalar" });
        else if (href === "/masraflar") navigate({ to: "/masraflar" });
        else if (href === "/tahsilatlar") navigate({ to: "/tahsilatlar" });
        else if (href === "/hatirlatmalar") navigate({ to: "/hatirlatmalar" });
        else if (href === "/ayarlar") navigate({ to: "/ayarlar" });
      }}
    />
  );
}
