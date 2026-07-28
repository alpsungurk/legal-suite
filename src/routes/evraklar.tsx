import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/evraklar")({
  head: () => ({
    meta: [
      { title: "Evraklar — Lex Yönetim" },
      { name: "description", content: "Evraklar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Evraklar — Lex Yönetim" },
      { property: "og:description", content: "Evraklar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={FileText}
        title="Evraklar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Evraklar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
