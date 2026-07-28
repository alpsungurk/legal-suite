import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/dosyalar")({
  head: () => ({
    meta: [
      { title: "Dosyalar — Lex Yönetim" },
      { name: "description", content: "Dosyalar bölümü — Lex Yönetim hukuk büro yönetim paneli." },
      { property: "og:title", content: "Dosyalar — Lex Yönetim" },
      { property: "og:description", content: "Dosyalar bölümü yakında kullanıma açılacak." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-3xl py-10">
      <EmptyState
        icon={FolderKanban}
        title="Dosyalar yakında"
        description="Bu bölüm hazırlanıyor. Kısa süre içinde büronuza özel Dosyalar deneyimi burada olacak."
        actionLabel="Dashboard'a dön"
      />
    </div>
  );
}
