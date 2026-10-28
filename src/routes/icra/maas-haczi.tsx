import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import type { SalaryGarnishment, SalaryGarnishmentEntry } from "@/lib/erp-types";
import { formatDate, today } from "@/lib/format";
import { newId } from "@/lib/mappers";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess, PageShell } from "@/components/app/bits";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useTrashDelete } from "@/components/forms/delete-actions";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/app/fields";

export const Route = createFileRoute("/icra/maas-haczi")({
  head: () => ({ meta: [{ title: "Maaş haczi sıraları — Avukat Yönetim Paneli" }] }),
  component: Page,
});

function sortEntries(entries: SalaryGarnishmentEntry[]): SalaryGarnishmentEntry[] {
  return [...entries]
    .sort((a, b) => {
      const da = a.notifiedAt || "9999";
      const db = b.notifiedAt || "9999";
      if (da !== db) return da.localeCompare(db);
      return a.position - b.position;
    })
    .map((e, i) => ({ ...e, position: i + 1 }));
}

function Page() {
  const { state, permissions, save } = useErp();
  const trash = useTrashDelete();
  const [form, setForm] = useState<{ open: boolean; record?: SalaryGarnishment }>({ open: false });

  const rows = useMemo(
    () =>
      [...state.salaryGarnishments].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName, "tr"),
      ),
    [state.salaryGarnishments],
  );

  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";

  type R = SalaryGarnishment;
  const columns: Column<R>[] = [
    {
      id: "employee",
      header: "Çalışan",
      sort: (r) => r.employeeName,
      export: (r) => r.employeeName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.employeeName}</p>
          <p className="truncate text-xs text-muted-foreground">{clientName(r.clientId)}</p>
        </div>
      ),
    },
    {
      id: "files",
      header: "Dosya",
      align: "center",
      sort: (r) => r.entries.length,
      export: (r) => r.entries.length,
      cell: (r) => r.entries.length,
    },
    {
      id: "payday",
      header: "Ödeme günü",
      hideBelow: "md",
      sort: (r) => r.payday ?? 99,
      export: (r) => (r.payday ? String(r.payday) : ""),
      cell: (r) => (r.payday ? `Ayın ${r.payday}. günü` : "—"),
    },
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.status,
      export: (r) => r.status,
      cell: (r) => (
        <StatusBadge tone={r.status === "Devam ediyor" ? "green" : "slate"} dot={false}>
          {r.status === "İşten ayrıldı" && r.leftAt
            ? `İşten ayrıldı · ${formatDate(r.leftAt)}`
            : r.status}
        </StatusBadge>
      ),
    },
  ];

  if (!permissions.can("enforcements")) return <NoAccess />;

  return (
    <PageShell>
      <PageHeader
        title="Maaş haczi sıraları"
        description="İşveren (müvekkil) ve çalışan başına sıralı icra dosyaları. Sıra tebliğ tarihine göre; elle değiştirilebilir. Nafaka gibi öncelikli hacizler listeye girer."
        icon={Users}
        actions={
          permissions.can("enforcements", "create") && (
            <Button onClick={() => setForm({ open: true })}>
              <Plus /> Yeni sıra
            </Button>
          )
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz maaş haczi sırası yok"
          description="İşveren müvekkil ve çalışan adıyla kayıt açın; altına icra dairesi + dosya no ekleyin."
          action={
            permissions.can("enforcements", "create") ? (
              <Button onClick={() => setForm({ open: true })}>
                <Plus /> Yeni sıra
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getId={(r) => r.id}
          searchText={(r) => [
            r.employeeName,
            clientName(r.clientId),
            ...r.entries.flatMap((e) => [e.office, e.fileNo]),
          ]}
          filters={[
            {
              id: "status",
              label: "Durum",
              options: ["Devam ediyor", "İşten ayrıldı"],
              get: (r) => r.status,
            },
          ]}
          initialSort={{ id: "employee", desc: false }}
          exportName="Maas-haczi-siraları"
          onRowClick={(r) => setForm({ open: true, record: r })}
          rowActions={(r) => (
            <>
              {permissions.can("enforcements", "edit") && (
                <DropdownMenuItem onClick={() => setForm({ open: true, record: r })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
              )}
              {permissions.can("enforcements", "delete") && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    trash(
                      "salary_garnishments",
                      [r.id],
                      `"${r.employeeName}" sırası çöp kutusuna taşınsın mı?`,
                    )
                  }
                >
                  <Trash2 /> Sil
                </DropdownMenuItem>
              )}
            </>
          )}
          mobileCard={(r) => (
            <div>
              <p className="font-medium">{r.employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {clientName(r.clientId)} · {r.entries.length} dosya · {r.status}
              </p>
            </div>
          )}
        />
      )}

      <QueueEditor
        open={form.open}
        record={form.record}
        onClose={() => setForm({ open: false })}
        onSave={(draft) => {
          save("salaryGarnishments", draft);
          toast.success(form.record ? "Güncellendi" : "Eklendi");
          setForm({ open: false });
        }}
      />
    </PageShell>
  );
}

function QueueEditor({
  open,
  record,
  onClose,
  onSave,
}: {
  open: boolean;
  record?: SalaryGarnishment;
  onClose: () => void;
  onSave: (
    d: Omit<SalaryGarnishment, "id" | "firmId" | "createdAt" | "updatedAt"> & { id?: string },
  ) => void;
}) {
  const { state, permissions, lawyers, currentUser } = useErp();
  const defaultResponsible = useMemo(
    () => (currentUser.role === "Avukat" ? [currentUser.id] : []),
    [currentUser.role, currentUser.id],
  );
  const canEdit = record
    ? permissions.can("enforcements", "edit")
    : permissions.can("enforcements", "create");
  const [clientId, setClientId] = useState(record?.clientId ?? "");
  const [employeeName, setEmployeeName] = useState(record?.employeeName ?? "");
  const [payday, setPayday] = useState(record?.payday != null ? String(record.payday) : "");
  const [status, setStatus] = useState(record?.status ?? "Devam ediyor");
  const [responsibleIds, setResponsibleIds] = useState<string[]>(
    record?.responsibleIds ?? defaultResponsible,
  );
  const [leftAt, setLeftAt] = useState(record?.leftAt ?? "");
  const [note, setNote] = useState(record?.note ?? "");
  const [entries, setEntries] = useState<SalaryGarnishmentEntry[]>(() =>
    record ? [...record.entries].sort((a, b) => a.position - b.position) : [],
  );

  useEffect(() => {
    if (!open) return;
    setClientId(record?.clientId ?? "");
    setEmployeeName(record?.employeeName ?? "");
    setPayday(record?.payday != null ? String(record.payday) : "");
    setStatus(record?.status ?? "Devam ediyor");
    setResponsibleIds(record?.responsibleIds ?? defaultResponsible);
    setLeftAt(record?.leftAt ?? "");
    setNote(record?.note ?? "");
    setEntries(record ? [...record.entries].sort((a, b) => a.position - b.position) : []);
  }, [open, record, defaultResponsible]);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[index], next[j]] = [next[j], next[index]];
    setEntries(next.map((e, i) => ({ ...e, position: i + 1 })));
  };

  const addEntry = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: newId(),
        office: "",
        fileNo: "",
        notifiedAt: today(),
        note: "",
        position: prev.length + 1,
      },
    ]);
  };

  const sortByNotify = () => setEntries(sortEntries(entries));

  const submit = () => {
    if (!canEdit) return;
    if (!clientId) {
      toast.error("İşveren (müvekkil) seçin");
      return;
    }
    if (!employeeName.trim()) {
      toast.error("Çalışan adını girin");
      return;
    }
    const pd = payday.trim() ? Number(payday) : undefined;
    if (pd != null && (!Number.isInteger(pd) || pd < 1 || pd > 31)) {
      toast.error("Maaş ödeme günü 1–31 olmalı");
      return;
    }
    for (const e of entries) {
      if (!e.office.trim() || !e.fileNo.trim()) {
        toast.error("Her dosyada icra dairesi ve dosya no zorunlu");
        return;
      }
    }
    onSave({
      id: record?.id,
      clientId,
      employeeName: employeeName.trim(),
      payday: pd,
      status: status as SalaryGarnishment["status"],
      responsibleIds,
      leftAt: status === "İşten ayrıldı" ? leftAt || today() : undefined,
      note: note.trim() || undefined,
      entries: entries.map((e, i) => ({
        ...e,
        office: e.office.trim(),
        fileNo: e.fileNo.trim(),
        notifiedAt: e.notifiedAt || undefined,
        note: e.note?.trim() || undefined,
        position: i + 1,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[min(92svh,880px)] w-[min(96vw,720px)] max-w-[min(96vw,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,720px)]">
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5 text-left">
          <DialogTitle>
            {record ? "Maaş haczi sırasını düzenle" : "Yeni maaş haczi sırası"}
          </DialogTitle>
          <DialogDescription>
            Tebliğ tarihine göre sıralayın; nafaka gibi öncelikli dosyaları yukarı taşıyın. Tutar
            girilmez.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">İşveren (müvekkil) *</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={clientId}
                disabled={!canEdit}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Seçin</option>
                {state.clients
                  .filter((c) => c.status !== "Pasif")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Çalışan *</Label>
              <Input
                className="mt-1"
                value={employeeName}
                disabled={!canEdit}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <Label className="text-xs">Aylık maaş ödeme günü (1–31)</Label>
              <Input
                className="mt-1"
                inputMode="numeric"
                value={payday}
                disabled={!canEdit}
                onChange={(e) => setPayday(e.target.value)}
                placeholder="Boşsa hatırlatma yok"
              />
            </div>
            <div>
              <Label className="text-xs">Sorumlu avukat</Label>
              <div className="mt-1">
                <MultiCombobox
                  value={responsibleIds}
                  onChange={setResponsibleIds}
                  options={lawyers.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="Boşsa hatırlatma yöneticilere gider"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Durum</Label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                disabled={!canEdit}
                onChange={(e) => setStatus(e.target.value as SalaryGarnishment["status"])}
              >
                <option value="Devam ediyor">Devam ediyor</option>
                <option value="İşten ayrıldı">İşten ayrıldı</option>
              </select>
            </div>
            {status === "İşten ayrıldı" && (
              <div>
                <Label className="text-xs">İşten ayrılış tarihi</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={leftAt}
                  disabled={!canEdit}
                  onChange={(e) => setLeftAt(e.target.value)}
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <Label className="text-xs">Not</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={note}
                disabled={!canEdit}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <p className="text-sm font-medium">İcra dosyaları ({entries.length})</p>
            <div className="flex gap-2">
              {canEdit && entries.length > 1 && (
                <Button type="button" size="sm" variant="outline" onClick={sortByNotify}>
                  Tebliğe göre sırala
                </Button>
              )}
              {canEdit && (
                <Button type="button" size="sm" onClick={addEntry}>
                  <Plus /> Dosya ekle
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                Henüz dosya yok. Örnek: Ankara Banka Alacakları İcra Dairesi · 2024/47030
              </p>
            )}
            {entries.map((e, i) => (
              <div
                key={e.id}
                className="grid gap-2 rounded-lg border border-border/70 bg-secondary/20 p-3 sm:grid-cols-[auto_1fr_1fr_auto]"
              >
                <div className="flex flex-col items-center gap-0.5 pt-1">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label="Yukarı"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={i === entries.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label="Aşağı"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <div>
                  <Label className="text-[11px]">İcra dairesi *</Label>
                  <Input
                    className="mt-0.5"
                    value={e.office}
                    disabled={!canEdit}
                    onChange={(ev) =>
                      setEntries((prev) =>
                        prev.map((x) => (x.id === e.id ? { ...x, office: ev.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Dosya no *</Label>
                  <Input
                    className="mt-0.5"
                    value={e.fileNo}
                    disabled={!canEdit}
                    onChange={(ev) =>
                      setEntries((prev) =>
                        prev.map((x) => (x.id === e.id ? { ...x, fileNo: ev.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="flex items-end justify-end">
                  {canEdit && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                      aria-label="Kaldır"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="sm:col-span-2 sm:col-start-2">
                  <Label className="text-[11px]">Tebliğ tarihi</Label>
                  <Input
                    className="mt-0.5"
                    type="date"
                    value={e.notifiedAt ?? ""}
                    disabled={!canEdit}
                    onChange={(ev) =>
                      setEntries((prev) =>
                        prev.map((x) =>
                          x.id === e.id ? { ...x, notifiedAt: ev.target.value || undefined } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="sm:col-span-2 sm:col-start-2">
                  <Label className="text-[11px]">Not (öncelik vb.)</Label>
                  <Input
                    className="mt-0.5"
                    value={e.note ?? ""}
                    disabled={!canEdit}
                    onChange={(ev) =>
                      setEntries((prev) =>
                        prev.map((x) => (x.id === e.id ? { ...x, note: ev.target.value } : x)),
                      )
                    }
                    placeholder="Nafaka / öncelikli…"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          {canEdit && <Button onClick={submit}>{record ? "Kaydet" : "Ekle"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
