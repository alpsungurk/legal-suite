import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, FileText, FolderKanban, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { formatDate, formatDateLong, relativeDue, today } from "@/lib/format";
import { Avatar, Section } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { openAttachment } from "@/lib/attachments";
import { usePortalData } from "@/routes/portal/-data";

export const Route = createFileRoute("/portal/dosyalar")({
  head: () => ({ meta: [{ title: "Dosyalarım — Müvekkil portalı" }] }),
  component: Page,
});

function Page() {
  const { state } = useErp();
  const { cases, events, documents } = usePortalData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dosyalarım"
        description="Büromuzda takip edilen dosyalarınız"
        icon={FolderKanban}
      />
      {cases.length === 0 && <EmptyState icon={FolderKanban} title="Görüntülenecek dosya yok" />}
      <div className="stagger space-y-4">
        {cases.map((c) => {
          const evs = events.filter((e) => e.caseId === c.id);
          const docs = documents.filter((d) => d.caseId === c.id);
          const next = evs.find((e) => e.date >= today() && e.status === "Bekliyor");
          const lawyers = c.responsibleIds
            .map((id) => state.users.find((u) => u.id === id))
            .filter(Boolean);
          return (
            <Section
              key={c.id}
              title={c.title}
              description={[c.court, c.esasNo].filter(Boolean).join(" · ") || c.type}
              actions={<StatusBadge status={c.status} />}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div className="space-y-3 md:col-span-2">
                  {next && (
                    <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <div className="text-sm">
                        <p className="font-semibold">
                          {next.title} · {relativeDue(next.date)}
                        </p>
                        <p className="text-muted-foreground">
                          {formatDateLong(next.date)} {next.time}{" "}
                          {next.location && `· ${next.location}`}
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Süreç
                  </p>
                  <ol className="relative space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
                    {[
                      ...evs.map((e) => ({
                        date: e.date,
                        text: e.title,
                        done: e.status === "Tamamlandı" || e.date < today(),
                      })),
                      { date: c.openingDate, text: "Dosya açıldı", done: true },
                    ]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((x, i) => (
                        <li key={i} className="relative flex items-start gap-3">
                          <span
                            className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-card ${x.done ? "bg-emerald-500" : "bg-blue-500"}`}
                          />
                          <span className="flex-1 text-sm">{x.text}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(x.date)}
                          </span>
                        </li>
                      ))}
                  </ol>
                  {docs.length > 0 && (
                    <div className="pt-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Belgeler
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {docs.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() =>
                              openAttachment(d.attachment).catch((e: Error) =>
                                toast.error(e.message),
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
                          >
                            <FileText className="h-3.5 w-3.5" /> {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Avukatınız
                  </p>
                  {lawyers.map((u) => (
                    <div key={u!.id} className="rounded-xl border border-border/80 p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u!.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{u!.name}</p>
                          <p className="text-xs text-muted-foreground">{u!.title}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                        {u!.phone && (
                          <a
                            href={`tel:${u!.phone}`}
                            className="inline-flex items-center gap-1.5 hover:text-primary"
                          >
                            <Phone className="h-3.5 w-3.5" /> {u!.phone}
                          </a>
                        )}
                        <a
                          href={`mailto:${u!.email}`}
                          className="inline-flex items-center gap-1.5 hover:text-primary"
                        >
                          <Mail className="h-3.5 w-3.5" /> {u!.email}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          );
        })}
      </div>
    </div>
  );
}
