import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { MessagesSquare } from "lucide-react";

/** Müvekkil ↔ büro mesajlaşması (her iki tarafta da kullanılır). */
export function ChatThread({ clientId, className }: { clientId: string; className?: string }) {
  const { state, currentUser, sendMessage, markMessagesRead } = useErp();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const messages = state.messages
    .filter((m) => m.clientId === clientId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const asClient = currentUser.role === "Müvekkil";

  useEffect(() => {
    markMessagesRead(clientId);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [clientId, messages.length, markMessagesRead]);

  const send = () => {
    if (!text.trim()) return;
    sendMessage(clientId, text);
    setText("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <EmptyState
            icon={MessagesSquare}
            title="Henüz mesaj yok"
            description="İlk mesajı siz gönderin."
            compact
          />
        )}
        {messages.map((m) => {
          const author = state.users.find((u) => u.id === m.authorId);
          const mine = m.authorId === currentUser.id;
          const fromClient = author?.role === "Müvekkil";
          const ownSide = asClient ? fromClient : !fromClient;
          return (
            <div
              key={m.id}
              className={cn("flex items-end gap-2 animate-fade-up", ownSide && "flex-row-reverse")}
            >
              <Avatar name={author?.name ?? "?"} size="sm" />
              <div className={cn("max-w-[78%] space-y-1", ownSide && "items-end text-right")}>
                <div
                  className={cn(
                    "whitespace-pre-line rounded-2xl px-3.5 py-2 text-left text-sm shadow-xs",
                    ownSide
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-border/80 bg-card",
                  )}
                >
                  {m.body}
                </div>
                <p className="px-1 text-[10px] text-muted-foreground">
                  {mine ? "Siz" : author?.name} · {formatDateTime(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-border/60 bg-card/60 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Mesaj yazın… (Enter gönderir, Shift+Enter yeni satır)"
          className="max-h-32 min-h-10 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={!text.trim()}
          aria-label="Gönder"
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
