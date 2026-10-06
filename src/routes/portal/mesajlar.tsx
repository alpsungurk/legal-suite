import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ChatThread } from "@/components/app/ChatThread";
import { usePortalData } from "@/routes/portal/-data";

export const Route = createFileRoute("/portal/mesajlar")({
  head: () => ({ meta: [{ title: "Mesajlar — Müvekkil portalı" }] }),
  component: Page,
});

function Page() {
  const { client } = usePortalData();
  if (!client) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesajlar"
        description="Avukatınıza doğrudan yazın; yanıtlar burada görünür"
        icon={MessagesSquare}
      />
      <div className="flex h-[calc(100svh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft animate-fade-up">
        <ChatThread clientId={client.id} className="flex-1" />
      </div>
    </div>
  );
}
