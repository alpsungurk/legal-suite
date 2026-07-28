import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/muvekkiller")({
  head: () => ({
    meta: [
      { title: "Müvekkiller — Lex Yönetim" },
      { name: "description", content: "Müvekkiller bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Müvekkiller — Lex Yönetim" },
      { property: "og:description", content: "Müvekkiller bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={Users}
        title="Müvekkiller yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Müvekkiller deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
