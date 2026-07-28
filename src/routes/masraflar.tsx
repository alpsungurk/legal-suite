import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/masraflar")({
  head: () => ({
    meta: [
      { title: "Masraflar — Lex Yönetim" },
      { name: "description", content: "Masraflar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Masraflar — Lex Yönetim" },
      { property: "og:description", content: "Masraflar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={Receipt}
        title="Masraflar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Masraflar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
