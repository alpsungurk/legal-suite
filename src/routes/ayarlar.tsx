import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/ayarlar")({
  head: () => ({
    meta: [
      { title: "Ayarlar — Lex Yönetim" },
      { name: "description", content: "Ayarlar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Ayarlar — Lex Yönetim" },
      { property: "og:description", content: "Ayarlar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={Settings}
        title="Ayarlar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Ayarlar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
