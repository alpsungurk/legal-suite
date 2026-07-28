import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/raporlar")({
  head: () => ({
    meta: [
      { title: "Raporlar — Lex Yönetim" },
      { name: "description", content: "Raporlar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Raporlar — Lex Yönetim" },
      { property: "og:description", content: "Raporlar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={BarChart3}
        title="Raporlar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Raporlar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
