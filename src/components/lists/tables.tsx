/** Hem liste sayfalarında hem detay sekmelerinde kullanılan tablolar. */
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  Download,
  Eye,
  HandCoins,
  Paperclip,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import type { Advance, CaseFile, DocumentFile, Expense, FeePlan, Reminder } from "@/lib/erp-types";
import {
  caseLabel,
  clientLedger,
  installmentStatus,
  planSummary,
  recordClientId,
  type LedgerEntry,
} from "@/lib/finance";
import { formatBytes, formatDate, relativeDue, today } from "@/lib/format";
import { DataTable, type Column } from "@/components/app/DataTable";
import { AvatarStack, Money, ProgressBar, TextLink } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import { downloadAttachment, openAttachment } from "@/lib/attachments";
import { cn } from "@/lib/utils";

type Hide = { client?: boolean; case?: boolean };

function useNames() {
  const { state } = useErp();
  return {
    client: (id?: string) => state.clients.find((c) => c.id === id),
    case: (id?: string) => state.cases.find((c) => c.id === id),
    user: (id?: string) => state.users.find((u) => u.id === id),
    account: (id?: string) => state.accounts.find((a) => a.id === id),
  };
}

/* ───────────── Masraflar ───────────── */

export function ExpenseTable({
  rows,
  hide = {},
  exportName = "Masraflar",
  toolbar,
}: {
  rows: Expense[];
  hide?: Hide;
  exportName?: string;
  toolbar?: React.ReactNode;
}) {
  const { state, permissions, remove, removeMany, currentUser } = useErp();
  const n = useNames();
  const quick = useQuick();
  const confirm = useConfirm();
  const canEdit = (e: Expense) => permissions.manageFinance || e.createdBy === currentUser.id;

  const columns: Column<Expense>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (e) => e.date,
      export: (e) => formatDate(e.date),
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</span>
      ),
    },
    {
      id: "title",
      header: "Masraf",
      sort: (e) => e.title,
      export: (e) => e.title,
      cell: (e) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{e.title}</span>
            {e.receipts.length > 0 && (
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </p>
          <p className="text-xs text-muted-foreground">{e.type}</p>
        </div>
      ),
    },
  ];
  if (!hide.case)
    columns.push({
      id: "case",
      header: "Dosya / müvekkil",
      hideBelow: "md",
      export: (e) =>
        e.chargeTo === "Büro"
          ? "Büro"
          : `${n.case(e.caseId)?.no ?? ""} ${n.client(recordClientId(state, e))?.name ?? ""}`,
      cell: (e) =>
        e.chargeTo === "Büro" ? (
          <StatusBadge status="Büro" tone="slate" dot={false}>
            Büro gideri
          </StatusBadge>
        ) : (
          <div className="min-w-0 text-sm">
            {e.caseId && <TextLink to={`/dosyalar/${e.caseId}`}>{n.case(e.caseId)?.no}</TextLink>}
            {!hide.client && (
              <p className="truncate text-xs text-muted-foreground">
                {n.client(recordClientId(state, e))?.name}
              </p>
            )}
          </div>
        ),
    });
  columns.push(
    {
      id: "paidBy",
      header: "Ödeyen",
      hideBelow: "lg",
      export: (e) => (e.paidBy === "Büro" ? (n.account(e.accountId)?.name ?? "Büro") : "Müvekkil"),
      cell: (e) => (
        <span className="text-sm text-muted-foreground">
          {e.paidBy === "Büro" ? (n.account(e.accountId)?.name ?? "Büro") : "Müvekkil ödedi"}
        </span>
      ),
    },
    {
      id: "receipt",
      header: "Belge",
      hideBelow: "xl",
      export: (e) => (e.receipts.length ? "Belgeli" : "Belgesiz"),
      cell: (e) => <StatusBadge status={e.receipts.length ? "Belgeli" : "Belgesiz"} />,
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (e) => e.amount,
      export: (e) => e.amount,
      cell: (e) => <Money value={e.amount} className="font-semibold" />,
    },
  );

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(e) => e.id}
      searchText={(e) => [
        e.title,
        e.type,
        n.case(e.caseId)?.no,
        n.client(recordClientId(state, e))?.name,
        e.note,
      ]}
      searchPlaceholder="Masraf, dosya veya müvekkil ara..."
      filters={[
        { id: "type", label: "Tür", options: state.settings.expenseTypes, get: (e) => e.type },
        {
          id: "charge",
          label: "Ait olduğu",
          options: ["Müvekkil", "Büro"],
          get: (e) => e.chargeTo,
        },
        {
          id: "receipt",
          label: "Belge",
          options: ["Belgeli", "Belgesiz"],
          get: (e) => (e.receipts.length ? "Belgeli" : "Belgesiz"),
        },
      ]}
      dateRange={{ label: "Tarih", get: (e) => e.date }}
      initialSort={{ id: "date", desc: true }}
      exportName={exportName}
      toolbar={toolbar}
      onRowClick={(e) => quick.open("expense", { record: e })}
      selectable={permissions.deleteRecords}
      bulkActions={(sel, clear) => (
        <DropdownLikeButton
          onClick={async () => {
            if (await confirm({ title: `${sel.length} masraf silinsin mi?` })) {
              removeMany(
                "expenses",
                sel.map((s) => s.id),
              );
              clear();
              toast.success("Masraflar silindi");
            }
          }}
        />
      )}
      footer={(visible) => (
        <tr>
          <td colSpan={99} className="px-4 py-3 text-right">
            <span className="mr-3 text-xs font-normal text-muted-foreground">
              {visible.length} kayıt toplamı
            </span>
            <Money value={visible.reduce((s, e) => s + e.amount, 0)} />
          </td>
        </tr>
      )}
      rowActions={(e) =>
        canEdit(e) ? (
          <>
            <DropdownMenuItem onClick={() => quick.open("expense", { record: e })}>
              <Pencil /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                quick.open("expense", {
                  preset: { ...e, id: undefined, date: today(), receipts: [] } as Partial<Expense>,
                })
              }
            >
              <RotateCcw /> Kopyala (tekrarla)
            </DropdownMenuItem>
            {(permissions.deleteRecords || e.createdBy === currentUser.id) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "Masraf silinsin mi?",
                        description: `${e.title} · ${formatDate(e.date)}`,
                      })
                    ) {
                      remove("expenses", e.id);
                      toast.success("Masraf silindi");
                    }
                  }}
                >
                  <Trash2 /> Sil
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : null
      }
      mobileCard={(e) => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{e.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDate(e.date)} · {e.type}
              {e.chargeTo === "Müvekkil" && ` · ${n.client(recordClientId(state, e))?.name ?? ""}`}
            </p>
          </div>
          <Money value={e.amount} className="font-semibold" />
        </div>
      )}
    />
  );
}

function DropdownLikeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15"
    >
      <Trash2 className="h-3.5 w-3.5" /> Seçilenleri sil
    </button>
  );
}

/* ───────────── Avanslar ───────────── */

export function AdvanceTable({ rows, hide = {} }: { rows: Advance[]; hide?: Hide }) {
  const { permissions, remove } = useErp();
  const n = useNames();
  const quick = useQuick();
  const confirm = useConfirm();
  const columns: Column<Advance>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (a) => a.date,
      export: (a) => formatDate(a.date),
      cell: (a) => <span className="text-muted-foreground">{formatDate(a.date)}</span>,
    },
    {
      id: "kind",
      header: "İşlem",
      export: (a) => a.kind,
      cell: (a) => <StatusBadge status={a.kind} />,
    },
  ];
  if (!hide.client)
    columns.push({
      id: "client",
      header: "Müvekkil",
      sort: (a) => n.client(a.clientId)?.name ?? "",
      export: (a) => n.client(a.clientId)?.name,
      cell: (a) => (
        <TextLink to={`/muvekkiller/${a.clientId}`}>{n.client(a.clientId)?.name}</TextLink>
      ),
    });
  columns.push(
    {
      id: "case",
      header: "Dosya",
      hideBelow: "md",
      export: (a) => n.case(a.caseId)?.no ?? "Genel",
      cell: (a) => (
        <span className="text-sm text-muted-foreground">
          {a.caseId ? caseLabel(n.case(a.caseId)) : "Genel avans"}
        </span>
      ),
    },
    {
      id: "account",
      header: "Hesap",
      hideBelow: "lg",
      export: (a) => n.account(a.accountId)?.name,
      cell: (a) => (
        <span className="text-sm text-muted-foreground">
          {n.account(a.accountId)?.name ?? "—"} · {a.method}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      sort: (a) => a.amount,
      export: (a) => (a.kind === "Avans" ? a.amount : -a.amount),
      cell: (a) => (
        <Money
          value={a.kind === "Avans" ? a.amount : -a.amount}
          signed
          colored
          className="font-semibold"
        />
      ),
    },
  );
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(a) => a.id}
      searchText={(a) => [n.client(a.clientId)?.name, n.case(a.caseId)?.no, a.note]}
      initialSort={{ id: "date", desc: true }}
      exportName="Masraf avansları"
      dateRange={{ label: "Tarih", get: (a) => a.date }}
      onRowClick={
        permissions.manageFinance ? (a) => quick.open("advance", { record: a }) : undefined
      }
      rowActions={
        permissions.manageFinance
          ? (a) => (
              <>
                <DropdownMenuItem onClick={() => quick.open("advance", { record: a })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    if (await confirm({ title: "Avans kaydı silinsin mi?" })) {
                      remove("advances", a.id);
                      toast.success("Kayıt silindi");
                    }
                  }}
                >
                  <Trash2 /> Sil
                </DropdownMenuItem>
              </>
            )
          : undefined
      }
      mobileCard={(a) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{n.client(a.clientId)?.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(a.date)} · {a.kind}
            </p>
          </div>
          <Money
            value={a.kind === "Avans" ? a.amount : -a.amount}
            signed
            colored
            className="font-semibold"
          />
        </div>
      )}
    />
  );
}

/* ───────────── Tahsilat planları ───────────── */

export function PlanTable({
  rows,
  hide = {},
  onOpen,
}: {
  rows: FeePlan[];
  hide?: Hide;
  onOpen?: (p: FeePlan) => void;
}) {
  const { permissions, remove, patch } = useErp();
  const n = useNames();
  const quick = useQuick();
  const confirm = useConfirm();
  const data = rows.map((p) => ({ plan: p, s: planSummary(p) }));
  type R = (typeof data)[number];
  const columns: Column<R>[] = [];
  if (!hide.client)
    columns.push({
      id: "client",
      header: "Müvekkil",
      sort: (r) => n.client(r.plan.clientId)?.name ?? "",
      export: (r) => n.client(r.plan.clientId)?.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{n.client(r.plan.clientId)?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.plan.title}</p>
        </div>
      ),
    });
  else
    columns.push({
      id: "title",
      header: "Plan",
      export: (r) => r.plan.title,
      cell: (r) => <span className="font-medium">{r.plan.title}</span>,
    });
  if (!hide.case)
    columns.push({
      id: "case",
      header: "Dosya",
      hideBelow: "lg",
      export: (r) => n.case(r.plan.caseId)?.no,
      cell: (r) =>
        r.plan.caseId ? (
          <TextLink to={`/dosyalar/${r.plan.caseId}`}>{n.case(r.plan.caseId)?.no}</TextLink>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    });
  columns.push(
    {
      id: "progress",
      header: "Tahsilat",
      hideBelow: "md",
      sort: (r) => r.s.progress,
      cell: (r) => (
        <div className="w-36">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>
              {r.plan.installments.length > 1
                ? `${r.plan.installments.filter((i) => installmentStatus(i) === "Ödendi").length}/${r.plan.installments.length} taksit`
                : "Tek ödeme"}
            </span>
            <span>%{Math.round(r.s.progress * 100)}</span>
          </div>
          <ProgressBar
            value={r.s.progress}
            tone={
              r.s.status === "Gecikmiş" ? "red" : r.s.status === "Tamamlandı" ? "green" : "primary"
            }
          />
        </div>
      ),
    },
    {
      id: "next",
      header: "Sıradaki vade",
      hideBelow: "lg",
      sort: (r) => r.s.next?.dueDate ?? "9999",
      export: (r) => (r.s.next ? formatDate(r.s.next.dueDate) : ""),
      cell: (r) =>
        r.s.next ? (
          <div className="text-sm">
            <p>{formatDate(r.s.next.dueDate)}</p>
            <p
              className={cn(
                "text-[11px]",
                r.s.next.dueDate < today() ? "text-rose-600" : "text-muted-foreground",
              )}
            >
              {relativeDue(r.s.next.dueDate)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "total",
      header: "Toplam",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.plan.total,
      export: (r) => r.plan.total,
      cell: (r) => <Money value={r.plan.total} className="text-muted-foreground" />,
    },
    {
      id: "remaining",
      header: "Kalan",
      align: "right",
      money: true,
      sort: (r) => r.s.remaining,
      export: (r) => r.s.remaining,
      cell: (r) => <Money value={r.s.remaining} className="font-semibold" />,
    },
    {
      id: "status",
      header: "Durum",
      sort: (r) => r.s.status,
      export: (r) => r.s.status,
      cell: (r) => <StatusBadge status={r.s.status} />,
    },
  );
  return (
    <DataTable
      rows={data}
      columns={columns}
      getId={(r) => r.plan.id}
      searchText={(r) => [n.client(r.plan.clientId)?.name, r.plan.title, n.case(r.plan.caseId)?.no]}
      searchPlaceholder="Müvekkil, dosya veya açıklama ara..."
      filters={[
        {
          id: "status",
          label: "Durum",
          options: ["Devam ediyor", "Gecikmiş", "Tamamlandı", "İptal"],
          get: (r) => r.s.status,
        },
        {
          id: "kind",
          label: "Tür",
          options: [
            "Vekalet ücreti",
            "Aylık ücret",
            "Danışmanlık",
            "Karşı vekalet ücreti",
            "Diğer",
          ],
          get: (r) => r.plan.kind,
        },
      ]}
      dateRange={{ label: "Tarih", get: (r) => r.plan.date }}
      initialSort={{ id: "next" }}
      exportName="Tahsilat planları"
      onRowClick={(r) => onOpen?.(r.plan)}
      rowActions={
        permissions.manageFinance
          ? (r) => (
              <>
                {r.s.remaining > 0 && !r.plan.cancelled && (
                  <DropdownMenuItem onClick={() => quick.open("payment", { plan: r.plan })}>
                    <HandCoins /> Tahsilat al
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => quick.open("plan", { record: r.plan })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => patch("plans", r.plan.id, { cancelled: !r.plan.cancelled })}
                >
                  {r.plan.cancelled ? <Undo2 /> : <Ban />}{" "}
                  {r.plan.cancelled ? "İptali geri al" : "İptal et"}
                </DropdownMenuItem>
                {permissions.deleteRecords && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        if (r.s.paid > 0) {
                          toast.error("Ödeme alınmış plan silinemez; iptal edebilirsiniz.");
                          return;
                        }
                        if (await confirm({ title: "Tahsilat planı silinsin mi?" })) {
                          remove("plans", r.plan.id);
                          toast.success("Plan silindi");
                        }
                      }}
                    >
                      <Trash2 /> Sil
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )
          : undefined
      }
      mobileCard={(r) => (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{n.client(r.plan.clientId)?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.plan.title}</p>
            </div>
            <StatusBadge status={r.s.status} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar value={r.s.progress} className="flex-1" />
            <Money value={r.s.remaining} className="text-sm font-semibold" />
          </div>
        </div>
      )}
    />
  );
}

/* ───────────── Dosyalar ───────────── */

export function CaseTable({
  rows,
  hide = {},
  exportName = "Dosyalar",
}: {
  rows: CaseFile[];
  hide?: Hide;
  exportName?: string;
}) {
  const { state, permissions, remove } = useErp();
  const n = useNames();
  const navigate = useNavigate();
  const quick = useQuick();
  const confirm = useConfirm();
  const nextEvent = (id: string) =>
    state.reminders
      .filter((r) => r.caseId === id && r.status === "Bekliyor" && r.date >= today())
      .sort((a, b) => a.date.localeCompare(b.date))[0];

  const columns: Column<CaseFile>[] = [
    {
      id: "no",
      header: "Dosya",
      sort: (c) => c.no,
      export: (c) => c.no,
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{c.no}</p>
          <p className="truncate font-medium">{c.title}</p>
        </div>
      ),
    },
  ];
  if (!hide.client)
    columns.push({
      id: "client",
      header: "Müvekkil",
      sort: (c) => n.client(c.clientId)?.name ?? "",
      export: (c) => n.client(c.clientId)?.name,
      cell: (c) => <span className="text-sm">{n.client(c.clientId)?.name ?? "—"}</span>,
    });
  columns.push(
    {
      id: "court",
      header: "Mahkeme / esas",
      hideBelow: "lg",
      export: (c) => [c.court, c.esasNo].filter(Boolean).join(" "),
      cell: (c) => (
        <div className="max-w-[240px] text-sm">
          <p className="truncate">{c.court ?? "—"}</p>
          {c.esasNo && <p className="text-xs text-muted-foreground">{c.esasNo}</p>}
        </div>
      ),
    },
    {
      id: "type",
      header: "Tür",
      hideBelow: "xl",
      export: (c) => c.type,
      cell: (c) => <span className="text-sm text-muted-foreground">{c.type}</span>,
    },
    {
      id: "resp",
      header: "Sorumlu",
      hideBelow: "md",
      export: (c) => c.responsibleIds.map((id) => n.user(id)?.name).join(", "),
      cell: (c) => <AvatarStack names={c.responsibleIds.map((id) => n.user(id)?.name ?? "?")} />,
    },
    {
      id: "next",
      header: "Sıradaki",
      hideBelow: "lg",
      sort: (c) => nextEvent(c.id)?.date ?? "9999",
      cell: (c) => {
        const e = nextEvent(c.id);
        return e ? (
          <div className="text-sm">
            <p className="truncate">{e.type}</p>
            <p className="text-xs text-muted-foreground">{relativeDue(e.date)}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "status",
      header: "Durum",
      sort: (c) => c.status,
      export: (c) => c.status,
      cell: (c) => <StatusBadge status={c.status} />,
    },
  );
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(c) => c.id}
      searchText={(c) => [
        c.no,
        c.title,
        c.court,
        c.esasNo,
        c.opposingParty,
        n.client(c.clientId)?.name,
      ]}
      searchPlaceholder="Dosya no, konu, mahkeme, esas no, taraf ara..."
      filters={[
        {
          id: "status",
          label: "Durum",
          options: ["Açık", "Derdest", "Karar", "Kanun yolu", "Kapalı"],
          get: (c) => c.status,
        },
        { id: "type", label: "Tür", options: state.settings.caseTypes, get: (c) => c.type },
        {
          id: "resp",
          label: "Sorumlu",
          options: state.users.filter((u) => u.role !== "Müvekkil").map((u) => u.name),
          get: (c) => c.responsibleIds.map((id) => n.user(id)?.name ?? ""),
        },
      ]}
      dateRange={{ label: "Açılış", get: (c) => c.openingDate }}
      initialSort={{ id: "no", desc: true }}
      exportName={exportName}
      onRowClick={(c) => navigate({ to: "/dosyalar/$id", params: { id: c.id } })}
      rowActions={
        permissions.manageRecords
          ? (c) => (
              <>
                <DropdownMenuItem onClick={() => quick.open("case", { record: c })}>
                  <Pencil /> Düzenle
                </DropdownMenuItem>
                {permissions.deleteRecords && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        const used =
                          state.expenses.some((e) => e.caseId === c.id) ||
                          state.plans.some((p) => p.caseId === c.id);
                        if (used) {
                          toast.error(
                            "Dosyaya bağlı masraf/tahsilat var. Silmek yerine 'Kapalı' yapın.",
                          );
                          return;
                        }
                        if (await confirm({ title: `${c.no} silinsin mi?` })) {
                          remove("cases", c.id);
                          toast.success("Dosya silindi");
                        }
                      }}
                    >
                      <Trash2 /> Sil
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )
          : undefined
      }
      mobileCard={(c) => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary">{c.no}</p>
            <p className="truncate font-medium">{c.title}</p>
            <p className="truncate text-xs text-muted-foreground">{n.client(c.clientId)?.name}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
      )}
    />
  );
}

/* ───────────── Ajanda ───────────── */

export function ReminderTable({ rows }: { rows: Reminder[] }) {
  const { patch, remove, permissions } = useErp();
  const n = useNames();
  const quick = useQuick();
  const confirm = useConfirm();
  const t = today();
  const columns: Column<Reminder>[] = [
    {
      id: "date",
      header: "Tarih",
      sort: (r) => `${r.date} ${r.time ?? ""}`,
      export: (r) => `${formatDate(r.date)} ${r.time ?? ""}`,
      cell: (r) => (
        <div className="text-sm">
          <p className="whitespace-nowrap">
            {formatDate(r.date)} {r.time && <span className="text-muted-foreground">{r.time}</span>}
          </p>
          {r.status === "Bekliyor" && (
            <p
              className={cn("text-[11px]", r.date < t ? "text-rose-600" : "text-muted-foreground")}
            >
              {relativeDue(r.date)}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "title",
      header: "Kayıt",
      export: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-medium",
              r.status !== "Bekliyor" && "text-muted-foreground line-through",
            )}
          >
            {r.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[r.location, r.caseId && n.case(r.caseId)?.no].filter(Boolean).join(" · ")}
          </p>
        </div>
      ),
    },
    {
      id: "type",
      header: "Tür",
      hideBelow: "md",
      export: (r) => r.type,
      cell: (r) => <StatusBadge status={r.type} />,
    },
    {
      id: "assignee",
      header: "Sorumlu",
      hideBelow: "lg",
      export: (r) => n.user(r.assigneeId)?.name,
      cell: (r) => <span className="text-sm">{n.user(r.assigneeId)?.name}</span>,
    },
    {
      id: "status",
      header: "Durum",
      export: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(r) => r.id}
      searchText={(r) => [r.title, r.type, r.location, n.case(r.caseId)?.no]}
      initialSort={{ id: "date" }}
      onRowClick={(r) => quick.open("reminder", { record: r })}
      exportName="Ajanda"
      rowActions={(r) => (
        <>
          {r.status === "Bekliyor" && (
            <DropdownMenuItem onClick={() => patch("reminders", r.id, { status: "Tamamlandı" })}>
              <CheckCircle2 /> Tamamlandı
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => quick.open("reminder", { record: r })}>
            <Pencil /> Düzenle
          </DropdownMenuItem>
          {permissions.manageRecords && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  if (await confirm({ title: "Kayıt silinsin mi?" })) remove("reminders", r.id);
                }}
              >
                <Trash2 /> Sil
              </DropdownMenuItem>
            </>
          )}
        </>
      )}
      mobileCard={(r) => (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(r.date)} {r.time} · {r.type}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>
      )}
    />
  );
}

/* ───────────── Belgeler ───────────── */

export function DocumentTable({ rows, hide = {} }: { rows: DocumentFile[]; hide?: Hide }) {
  const { state, permissions, remove, patch } = useErp();
  const n = useNames();
  const quick = useQuick();
  const confirm = useConfirm();
  const run = (fn: () => Promise<void>) => fn().catch((e: Error) => toast.error(e.message));
  const columns: Column<DocumentFile>[] = [
    {
      id: "name",
      header: "Belge",
      sort: (d) => d.name,
      export: (d) => d.name,
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{d.name}</p>
          <p className="text-xs text-muted-foreground">
            {d.category} · {formatBytes(d.attachment.size)}
          </p>
        </div>
      ),
    },
  ];
  if (!hide.case)
    columns.push({
      id: "case",
      header: "Dosya / müvekkil",
      hideBelow: "md",
      export: (d) => n.case(d.caseId)?.no,
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {d.caseId ? n.case(d.caseId)?.no : ""}{" "}
          {n.client(d.clientId ?? recordClientId(state, d))?.name}
        </span>
      ),
    });
  columns.push(
    {
      id: "by",
      header: "Yükleyen",
      hideBelow: "lg",
      export: (d) => n.user(d.uploadedBy)?.name,
      cell: (d) => <span className="text-sm">{n.user(d.uploadedBy)?.name}</span>,
    },
    {
      id: "date",
      header: "Tarih",
      sort: (d) => d.createdAt,
      export: (d) => formatDate(d.createdAt.slice(0, 10)),
      cell: (d) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(d.createdAt.slice(0, 10))}
        </span>
      ),
    },
    {
      id: "portal",
      header: "Portal",
      hideBelow: "md",
      export: (d) => (d.visibleToClient ? "Görünür" : "Gizli"),
      cell: (d) => (
        <StatusBadge
          status={d.visibleToClient ? "Görünür" : "Gizli"}
          tone={d.visibleToClient ? "green" : "slate"}
        />
      ),
    },
  );
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getId={(d) => d.id}
      searchText={(d) => [d.name, d.category, n.case(d.caseId)?.no, n.client(d.clientId)?.name]}
      filters={[
        {
          id: "cat",
          label: "Kategori",
          options: state.settings.documentCategories,
          get: (d) => d.category,
        },
      ]}
      initialSort={{ id: "date", desc: true }}
      exportName="Belgeler"
      onRowClick={(d) => run(() => openAttachment(d.attachment))}
      rowActions={(d) => (
        <>
          <DropdownMenuItem onClick={() => run(() => openAttachment(d.attachment))}>
            <Eye /> Görüntüle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => downloadAttachment(d.attachment))}>
            <Download /> İndir
          </DropdownMenuItem>
          {permissions.manageRecords && (
            <>
              <DropdownMenuItem
                onClick={() => patch("documents", d.id, { visibleToClient: !d.visibleToClient })}
              >
                <Eye /> {d.visibleToClient ? "Portalda gizle" : "Portalda göster"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => quick.open("document", { record: d })}>
                <Pencil /> Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  if (await confirm({ title: "Belge silinsin mi?", description: d.name })) {
                    remove("documents", d.id);
                    toast.success("Belge silindi");
                  }
                }}
              >
                <Trash2 /> Sil
              </DropdownMenuItem>
            </>
          )}
        </>
      )}
      mobileCard={(d) => (
        <div>
          <p className="truncate font-medium">{d.name}</p>
          <p className="text-xs text-muted-foreground">
            {d.category} · {formatDate(d.createdAt.slice(0, 10))}
          </p>
        </div>
      )}
    />
  );
}

/* ───────────── Cari ekstre ───────────── */

export function LedgerTable({
  clientId,
  from,
  to,
}: {
  clientId: string;
  from?: string;
  to?: string;
}) {
  const { state } = useErp();
  const n = useNames();
  const { entries, opening, closing } = clientLedger(state, clientId, { from, to });
  const columns: Column<LedgerEntry>[] = [
    {
      id: "date",
      header: "Tarih",
      export: (e) => formatDate(e.date),
      cell: (e) => (
        <span className="whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</span>
      ),
    },
    {
      id: "desc",
      header: "Açıklama",
      export: (e) => `${e.kind} - ${e.description}`,
      cell: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{e.description}</p>
          <p className="text-xs text-muted-foreground">
            {e.kind}
            {e.caseId && ` · ${n.case(e.caseId)?.no}`}
          </p>
        </div>
      ),
    },
    {
      id: "debit",
      header: "Borç",
      align: "right",
      money: true,
      export: (e) => e.debit || null,
      cell: (e) =>
        e.debit ? <Money value={e.debit} /> : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "credit",
      header: "Alacak",
      align: "right",
      money: true,
      export: (e) => e.credit || null,
      cell: (e) =>
        e.credit ? (
          <Money value={e.credit} className="text-emerald-600 dark:text-emerald-400" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "balance",
      header: "Bakiye",
      align: "right",
      money: true,
      export: (e) => e.balance,
      cell: (e) => (
        <span className="money font-semibold">
          {Math.abs(e.balance).toLocaleString("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 2,
          })}{" "}
          <span className="text-[10px] font-medium text-muted-foreground">
            {e.balance > 0 ? "(B)" : e.balance < 0 ? "(A)" : ""}
          </span>
        </span>
      ),
    },
  ];
  return (
    <DataTable
      rows={entries}
      columns={columns}
      getId={(e) => `${e.kind}-${e.id}`}
      exportName={`Ekstre ${n.client(clientId)?.name ?? ""}`}
      pageSize={100}
      footer={() => (
        <tr>
          <td colSpan={2} className="px-4 py-3 text-xs font-normal text-muted-foreground">
            {from
              ? `Devreden: ${opening.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}`
              : "Kapanış bakiyesi"}
          </td>
          <td className="px-4 py-3 text-right">
            <Money value={entries.reduce((s, e) => s + e.debit, 0)} />
          </td>
          <td className="px-4 py-3 text-right">
            <Money value={entries.reduce((s, e) => s + e.credit, 0)} />
          </td>
          <td className="px-4 py-3 text-right">
            <Money value={Math.abs(closing)} />{" "}
            <span className="text-[10px] text-muted-foreground">
              {closing > 0 ? "Borçlu" : closing < 0 ? "Alacaklı" : ""}
            </span>
          </td>
        </tr>
      )}
    />
  );
}
