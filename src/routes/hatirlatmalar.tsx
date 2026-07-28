import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/hatirlatmalar")({
  head: () => ({
    meta: [
      { title: "Hatırlatmalar — Lex Yönetim" },
      { name: "description", content: "Hatırlatmalar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Hatırlatmalar — Lex Yönetim" },
      { property: "og:description", content: "Hatırlatmalar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={BellRing}
        title="Hatırlatmalar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Hatırlatmalar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
