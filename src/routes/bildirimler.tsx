import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/bildirimler")({
  head: () => ({
    meta: [
      { title: "Bildirimler — Lex Yönetim" },
      { name: "description", content: "Bildirimler bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Bildirimler — Lex Yönetim" },
      { property: "og:description", content: "Bildirimler bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={Bell}
        title="Bildirimler yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Bildirimler deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
