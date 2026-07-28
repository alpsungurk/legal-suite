import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/tahsilatlar")({
  head: () => ({
    meta: [
      { title: "Tahsilatlar — Lex Yönetim" },
      { name: "description", content: "Tahsilatlar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Tahsilatlar — Lex Yönetim" },
      { property: "og:description", content: "Tahsilatlar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={Wallet}
        title="Tahsilatlar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Tahsilatlar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
