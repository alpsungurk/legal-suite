import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessagesSquare, Search } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { matches, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Avatar, PageShell } from "@/components/app/bits";
import { ChatThread } from "@/components/app/ChatThread";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

type Search = { musteri?: string };

export const Route = createFileRoute("/mesajlar")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    musteri: typeof s.musteri === "string" ? s.musteri : undefined,
  }),
  head: () => ({ meta: [{ title: "Mesajlar — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { musteri } = Route.useSearch();
  const navigate = useNavigate();
  const { state } = useErp();
  const [q, setQ] = useState("");

  const threads = state.clients
    .map((c) => {
      const msgs = state.messages.filter((m) => m.clientId === c.id);
      const last = msgs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return { client: c, last, unread: msgs.filter((m) => !m.readByFirm).length };
    })
    .filter(
      (t) =>
        (t.last || t.client.portalEnabled || t.client.id === musteri) && matches(q, t.client.name),
    )
    .sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));

  const active = state.clients.find((c) => c.id === musteri);
  const select = (id?: string) =>
    navigate({ to: "/mesajlar", search: { musteri: id }, replace: true });

  return (
    <PageShell>
      <PageHeader
        title="Mesajlar"
        description="Müvekkil portalı üzerinden gelen ve giden mesajlar"
        icon={MessagesSquare}
      />
      <div className="grid h-[calc(100svh-15rem)] min-h-[460px] grid-cols-1 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft animate-fade-up md:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-r border-border/60",
            active && "hidden md:flex",
          )}
        >
          <div className="relative border-b border-border/60 p-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Müvekkil ara..."
              className="h-9 pl-9"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {threads.map((t) => (
              <li key={t.client.id}>
                <button
                  type="button"
                  onClick={() => select(t.client.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    musteri === t.client.id ? "bg-secondary" : "hover:bg-secondary/50",
                  )}
                >
                  <Avatar name={t.client.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          t.unread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {t.client.name}
                      </span>
                      {t.last && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(t.last.createdAt)}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {t.last?.body ?? "Henüz mesaj yok"}
                      </span>
                      {t.unread > 0 && (
                        <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          {t.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {threads.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Portalı açık müvekkil yok
              </p>
            )}
          </ul>
        </aside>
        <section className={cn("flex min-h-0 flex-col", !active && "hidden md:flex")}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  onClick={() => select(undefined)}
                  aria-label="Geri"
                >
                  <ArrowLeft />
                </Button>
                <Avatar name={active.name} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/muvekkiller/$id"
                    params={{ id: active.id }}
                    className="truncate font-semibold hover:text-primary"
                  >
                    {active.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {active.portalEnabled
                      ? "Portal açık"
                      : "Portal kapalı — mesajı müvekkil göremez"}
                  </p>
                </div>
              </header>
              <ChatThread clientId={active.id} className="flex-1" />
            </>
          ) : (
            <div className="grid flex-1 place-items-center">
              <EmptyState
                icon={MessagesSquare}
                title="Bir konuşma seçin"
                description="Soldan bir müvekkil seçerek mesajlaşmaya başlayın."
              />
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
