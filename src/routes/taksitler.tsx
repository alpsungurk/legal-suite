import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CalendarClock, CalendarRange, CheckCircle2, HandCoins } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { allInstallments, type InstallmentRow } from "@/lib/finance";
import { addDays, formatDate, formatMoney, relativeDue, sumBy, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { Money, NoAccess, PageShell, TextLink } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PlanSheet } from "@/components/lists/PlanSheet";
import { useQuick } from "@/components/forms/quick";
import { DateChip } from "@/components/dashboard/widgets";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/taksitler")({
  head: () => ({ meta: [{ title: "Taksitler — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions } = useErp();
  const quick = useQuick();
  const [view, setView] = useState("open");
  const [planId, setPlanId] = useState<string | null>(null);
  if (!permissions.viewFinance) return <NoAccess />;

  const t = today();
  const all = allInstallments(state);
  const open = all.filter((r) => r.status !== "Ödendi");
  const overdue = open.filter((r) => r.status === "Gecikmiş");
  const week = open.filter((r) => r.inst.dueDate >= t && r.inst.dueDate <= addDays(t, 7));
  const month = open.filter(
    (r) => r.inst.dueDate >= t && r.inst.dueDate.slice(0, 7) === t.slice(0, 7),
  );

  const rows =
    view === "overdue"
      ? overdue
      : view === "week"
        ? week
        : view === "month"
          ? month
          : view === "paid"
            ? all.filter((r) => r.status === "Ödendi")
            : open;

  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const caseNo = (id?: string) => state.cases.find((c) => c.id === id)?.no;

  const columns: Column<InstallmentRow>[] = [
    {
      id: "due",
      header: "Vade",
      sort: (r) => r.inst.dueDate,
      export: (r) => formatDate(r.inst.dueDate),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <DateChip date={r.inst.dueDate} danger={r.status === "Gecikmiş"} />
          <span
            className={cn(
              "hidden text-xs sm:inline",
              r.status === "Gecikmiş" ? "font-medium text-rose-600" : "text-muted-foreground",
            )}
          >
            {r.status === "Ödendi" ? "Ödendi" : relativeDue(r.inst.dueDate)}
          </span>
        </div>
      ),
    },
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => clientName(r.plan.clientId),
      export: (r) => clientName(r.plan.clientId),
      cell: (r) => (
        <div className="min-w-0">
          <TextLink to={`/muvekkiller/${r.plan.clientId}`}>{clientName(r.plan.clientId)}</TextLink>
          <p className="truncate text-xs text-muted-foreground">
            {r.plan.title}
            {caseNo(r.plan.caseId) && ` · ${caseNo(r.plan.caseId)}`}
          </p>
        </div>
      ),
    },
    {
      id: "no",
      header: "Taksit",
      hideBelow: "md",
      export: (r) => `${r.index + 1}/${r.plan.installments.length}`,
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.index + 1} / {r.plan.installments.length}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Tutar",
      align: "right",
      money: true,
      hideBelow: "md",
      sort: (r) => r.inst.amount,
      export: (r) => r.inst.amount,
      cell: (r) => <Money value={r.inst.amount} className="text-muted-foreground" />,
    },
    {
      id: "remaining",
      header: "Kalan",
      align: "right",
      money: true,
      sort: (r) => r.remaining,
      export: (r) => r.remaining,
      cell: (r) => <Money value={r.remaining} className="font-semibold" />,
    },
    {
      id: "status",
      header: "Durum",
      export: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (r) =>
        r.status !== "Ödendi" && permissions.manageFinance ? (
          <Button
            size="sm"
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              quick.open("payment", { plan: r.plan, installmentId: r.inst.id });
            }}
          >
            <HandCoins /> Tahsil et
          </Button>
        ) : null,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Taksitler"
        description="Tüm tahsilat planlarındaki vadeler tek listede"
        icon={CalendarClock}
      />
      <StatGrid>
        <StatTile
          label="Vadesi geçmiş"
          value={formatMoney(sumBy(overdue, (r) => r.remaining))}
          icon={AlertCircle}
          tone="red"
          hint={`${overdue.length} taksit`}
          hintTone={overdue.length ? "red" : undefined}
        />
        <StatTile
          label="7 gün içinde"
          value={formatMoney(sumBy(week, (r) => r.remaining))}
          icon={CalendarRange}
          tone="amber"
          hint={`${week.length} taksit`}
        />
        <StatTile
          label="Bu ay kalan"
          value={formatMoney(sumBy(month, (r) => r.remaining))}
          icon={CalendarClock}
          tone="blue"
          hint={`${month.length} taksit`}
        />
        <StatTile
          label="Toplam açık"
          value={formatMoney(sumBy(open, (r) => r.remaining))}
          icon={CheckCircle2}
          tone="violet"
          hint={`${open.length} taksit`}
        />
      </StatGrid>
      <Segmented
        className="w-full sm:w-auto"
        value={view}
        onChange={setView}
        options={[
          { value: "overdue", label: `Gecikmiş (${overdue.length})` },
          { value: "week", label: "Bu hafta" },
          { value: "month", label: "Bu ay" },
          { value: "open", label: "Tüm açık" },
          { value: "paid", label: "Ödenen" },
        ]}
      />
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.inst.id}
        searchText={(r) => [clientName(r.plan.clientId), r.plan.title, caseNo(r.plan.caseId)]}
        searchPlaceholder="Müvekkil veya plan ara..."
        initialSort={{ id: "due", desc: view === "paid" }}
        exportName="Taksitler"
        onRowClick={(r) => setPlanId(r.plan.id)}
        rowActions={(r) => (
          <DropdownMenuItem onClick={() => setPlanId(r.plan.id)}>
            <CalendarClock /> Planı aç
          </DropdownMenuItem>
        )}
        footer={(visible) => (
          <tr>
            <td colSpan={99} className="px-4 py-3 text-right">
              <span className="mr-3 text-xs font-normal text-muted-foreground">Kalan toplam</span>
              <Money value={sumBy(visible, (r) => r.remaining)} />
            </td>
          </tr>
        )}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <DateChip date={r.inst.dueDate} danger={r.status === "Gecikmiş"} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{clientName(r.plan.clientId)}</p>
              <p className="truncate text-xs text-muted-foreground">{r.plan.title}</p>
            </div>
            <Money value={r.remaining} className="font-semibold" />
          </div>
        )}
      />
      <PlanSheet planId={planId} onOpenChange={(o) => !o && setPlanId(null)} />
    </PageShell>
  );
}
