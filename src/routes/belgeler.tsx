import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileQuestion, FolderOpen, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { formatBytes, formatDate, relativeDue, sumBy, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { DocumentTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import type { DocumentRequest } from "@/lib/erp-types";
import { openAttachment } from "@/lib/attachments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/belgeler")({
  head: () => ({ meta: [{ title: "Belgeler — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, patch, remove } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const reqs = state.docRequests;
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";

  const columns: Column<DocumentRequest>[] = [
    {
      id: "title",
      header: "Talep",
      export: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.title}</p>
          {r.note && <p className="truncate text-xs text-muted-foreground">{r.note}</p>}
        </div>
      ),
    },
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => clientName(r.clientId),
      export: (r) => clientName(r.clientId),
      cell: (r) => <span className="text-sm">{clientName(r.clientId)}</span>,
    },
    {
      id: "due",
      header: "Son tarih",
      hideBelow: "md",
      sort: (r) => r.dueDate ?? "9999",
      export: (r) => formatDate(r.dueDate),
      cell: (r) => (
        <div className="text-sm">
          <p>{formatDate(r.dueDate)}</p>
          {r.dueDate && r.status === "Bekliyor" && (
            <p
              className={cn(
                "text-[11px]",
                r.dueDate < today() ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              {relativeDue(r.dueDate)}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.status,
      export: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const docBytes = sumBy(state.documents, (d) => d.attachment.size);

  return (
    <PageShell>
      <PageHeader
        title="Belgeler"
        description="Dosya belgeleri, müvekkil yüklemeleri ve belge talepleri"
        icon={FolderOpen}
        actions={
          <>
            <Button variant="outline" onClick={() => quick.open("docRequest")}>
              <FileQuestion /> Müvekkilden iste
            </Button>
            <Button onClick={() => quick.open("document")}>
              <Upload /> Belge yükle
            </Button>
          </>
        }
      />
      <StatGrid>
        <StatTile
          label="Belge"
          value={state.documents.length}
          icon={FolderOpen}
          tone="blue"
          hint={formatBytes(docBytes)}
        />
        <StatTile
          label="Portalda görünür"
          value={state.documents.filter((d) => d.visibleToClient).length}
          tone="green"
        />
        <StatTile
          label="Bekleyen talep"
          value={reqs.filter((r) => r.status === "Bekliyor").length}
          icon={FileQuestion}
          tone="amber"
        />
        <StatTile
          label="Müvekkil yükledi"
          value={reqs.filter((r) => r.status === "Yüklendi").length}
          icon={CheckCircle2}
          tone="violet"
          hint="İncelenmeyi bekliyor"
        />
      </StatGrid>
      <Tabs defaultValue={reqs.some((r) => r.status === "Yüklendi") ? "talepler" : "belgeler"}>
        <TabsList>
          <TabsTrigger value="belgeler">Belgeler ({state.documents.length})</TabsTrigger>
          <TabsTrigger value="talepler">Belge talepleri ({reqs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="belgeler" className="mt-4">
          <DocumentTable rows={state.documents} />
        </TabsContent>
        <TabsContent value="talepler" className="mt-4">
          <DataTable
            rows={reqs}
            columns={columns}
            getId={(r) => r.id}
            searchText={(r) => [r.title, clientName(r.clientId)]}
            filters={[
              {
                id: "st",
                label: "Durum",
                options: ["Bekliyor", "Yüklendi", "Kapatıldı"],
                get: (r) => r.status,
              },
            ]}
            initialSort={{ id: "due" }}
            exportName="Belge talepleri"
            onRowClick={(r) => quick.open("docRequest", { record: r })}
            rowActions={(r) => {
              const doc = state.documents.find((d) => d.id === r.documentId);
              return (
                <>
                  {doc && (
                    <DropdownMenuItem
                      onClick={() =>
                        openAttachment(doc.attachment).catch((e: Error) => toast.error(e.message))
                      }
                    >
                      <FolderOpen /> Yüklenen belgeyi aç
                    </DropdownMenuItem>
                  )}
                  {r.status !== "Kapatıldı" && (
                    <DropdownMenuItem
                      onClick={() => patch("docRequests", r.id, { status: "Kapatıldı" })}
                    >
                      <CheckCircle2 /> Kapat (tamamlandı)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => quick.open("docRequest", { record: r })}>
                    <Pencil /> Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      if (await confirm({ title: "Talep silinsin mi?" }))
                        remove("docRequests", r.id);
                    }}
                  >
                    <Trash2 /> Sil
                  </DropdownMenuItem>
                </>
              );
            }}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{clientName(r.clientId)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            )}
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
