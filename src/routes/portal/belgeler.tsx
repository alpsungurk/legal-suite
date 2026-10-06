import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileQuestion, FileText, Upload } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { formatDate, relativeDue } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Section } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { DocumentTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { usePortalData } from "@/routes/portal/-data";

export const Route = createFileRoute("/portal/belgeler")({
  head: () => ({ meta: [{ title: "Belgeler — Müvekkil portalı" }] }),
  component: Page,
});

function Page() {
  const { state } = useErp();
  const quick = useQuick();
  const { documents, requests } = usePortalData();
  const caseNo = (id?: string) => state.cases.find((c) => c.id === id)?.title;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Belgeler"
        description="Avukatınızın paylaştığı belgeler ve sizden istenenler"
        icon={FileText}
        actions={
          <Button onClick={() => quick.open("document")}>
            <Upload /> Belge gönder
          </Button>
        }
      />
      <Section title="İstenen belgeler" bodyClassName="p-2">
        {requests.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Bekleyen talep yok" compact />
        ) : (
          <ul className="stagger space-y-1">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-lg ${r.status === "Bekliyor" ? "bg-amber-500/12 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
                >
                  <FileQuestion className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      caseNo(r.caseId),
                      r.note,
                      r.dueDate && `Son tarih ${formatDate(r.dueDate)} (${relativeDue(r.dueDate)})`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <StatusBadge status={r.status === "Kapatıldı" ? "Tamamlandı" : r.status} />
                {r.status === "Bekliyor" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      quick.open("document", {
                        preset: { requestId: r.id, caseId: r.caseId, category: "Diğer" },
                      })
                    }
                  >
                    <Upload /> Yükle
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <DocumentTable rows={documents} />
    </div>
  );
}
