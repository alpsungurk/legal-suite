import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { clientFinance } from "@/lib/finance";
import { PageHeader } from "@/components/app/PageHeader";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Avatar, Money, PageShell } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import type { Client } from "@/lib/erp-types";
import { formatMoney, sumBy } from "@/lib/format";

export const Route = createFileRoute("/muvekkiller/")({
  head: () => ({ meta: [{ title: "Müvekkiller — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, permissions, remove } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const rows = state.clients.map((c) => ({
    client: c,
    cases: state.cases.filter((x) => x.clientId === c.id && x.status !== "Kapalı").length,
    fin: permissions.viewFinance ? clientFinance(state, c.id) : null,
  }));
  type R = (typeof rows)[number];

  const columns: Column<R>[] = [
    {
      id: "name",
      header: "Müvekkil",
      sort: (r) => r.client.name,
      export: (r) => r.client.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.client.name} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.client.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {r.client.kind}
              {r.client.portalEnabled && " · Portal açık"}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "contact",
      header: "İletişim",
      hideBelow: "lg",
      export: (r) => r.client.phone,
      cell: (r) => (
        <div className="text-sm">
          <p>{r.client.phone}</p>
          <p className="text-xs text-muted-foreground">{r.client.email}</p>
        </div>
      ),
    },
    {
      id: "cases",
      header: "Açık dosya",
      align: "center",
      sort: (r) => r.cases,
      export: (r) => r.cases,
      cell: (r) => <span className="font-medium">{r.cases}</span>,
    },
  ];
  if (permissions.viewFinance) {
    columns.push(
      {
        id: "advance",
        header: "Avans bakiyesi",
        align: "right",
        money: true,
        sort: (r) => r.fin!.advance.balance,
        export: (r) => r.fin!.advance.balance,
        cell: (r) => (
          <Money
            value={r.fin!.advance.balance}
            colored={r.fin!.advance.balance < 0}
            className="font-medium"
          />
        ),
      },
      {
        id: "fee",
        header: "Ücret alacağı",
        align: "right",
        money: true,
        hideBelow: "md",
        sort: (r) => r.fin!.feeRemaining,
        export: (r) => r.fin!.feeRemaining,
        cell: (r) => (
          <div>
            <Money value={r.fin!.feeRemaining} className="font-medium" />
            {r.fin!.feeOverdue > 0 && (
              <p className="text-[11px] text-rose-600">{formatMoney(r.fin!.feeOverdue)} gecikmiş</p>
            )}
          </div>
        ),
      },
    );
  }
  columns.push({
    id: "status",
    header: "Durum",
    sort: (r) => r.client.status,
    export: (r) => r.client.status,
    cell: (r) => <StatusBadge status={r.client.status} />,
  });

  const del = async (c: Client) => {
    const used =
      state.cases.some((x) => x.clientId === c.id) ||
      state.plans.some((x) => x.clientId === c.id) ||
      state.advances.some((x) => x.clientId === c.id) ||
      state.expenses.some((x) => x.clientId === c.id);
    if (used) {
      toast.error(
        "Bu müvekkile bağlı dosya veya finans kaydı var. Silmek yerine 'Pasif' yapabilirsiniz.",
      );
      return;
    }
    if (
      await confirm({ title: `${c.name} silinsin mi?`, description: "Bu işlem geri alınamaz." })
    ) {
      remove("clients", c.id);
      toast.success("Müvekkil silindi");
    }
  };

  const active = state.clients.filter((c) => c.status === "Aktif");
  const fins = rows.filter((r) => r.fin).map((r) => r.fin!);

  return (
    <PageShell>
      <PageHeader
        title="Müvekkiller"
        description="Müvekkil kartları, dosyalar ve finansal durum"
        icon={Users}
        actions={
          permissions.manageRecords && (
            <Button
              onClick={() =>
                quick.open("client", {
                  onSaved: (c) => navigate({ to: "/muvekkiller/$id", params: { id: c.id } }),
                })
              }
            >
              <Plus /> Yeni müvekkil
            </Button>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Aktif müvekkil"
          value={active.length}
          icon={Users}
          tone="blue"
          hint={`${state.clients.length - active.length} pasif`}
        />
        <StatTile
          label="Kurumsal"
          value={state.clients.filter((c) => c.kind === "Kurumsal").length}
          tone="violet"
          hint={`${state.clients.filter((c) => c.monthlyFee).length} aylık ücretli`}
        />
        {permissions.viewFinance && (
          <>
            <StatTile
              label="Toplam avans bakiyesi"
              value={formatMoney(sumBy(fins, (f) => f.advance.balance))}
              tone="green"
              hint={`${fins.filter((f) => f.lowAdvance).length} müvekkilde avans azaldı`}
              hintTone={fins.some((f) => f.lowAdvance) ? "amber" : undefined}
            />
            <StatTile
              label="Ücret alacağı"
              value={formatMoney(sumBy(fins, (f) => f.feeRemaining))}
              tone="amber"
              hint={`${formatMoney(sumBy(fins, (f) => f.feeOverdue))} gecikmiş`}
              hintTone="red"
            />
          </>
        )}
      </StatGrid>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.client.id}
        searchText={(r) => [r.client.name, r.client.phone, r.client.email, r.client.identity]}
        searchPlaceholder="İsim, telefon, e-posta veya TC/VKN ara..."
        filters={[
          {
            id: "kind",
            label: "Tür",
            options: ["Bireysel", "Kurumsal"],
            get: (r) => r.client.kind,
          },
          {
            id: "status",
            label: "Durum",
            options: ["Aktif", "Pasif"],
            get: (r) => r.client.status,
          },
        ]}
        initialSort={{ id: "name" }}
        exportName="Müvekkiller"
        onRowClick={(r) => navigate({ to: "/muvekkiller/$id", params: { id: r.client.id } })}
        rowActions={
          permissions.manageRecords
            ? (r) => (
                <>
                  <DropdownMenuItem onClick={() => quick.open("client", { record: r.client })}>
                    <Pencil /> Düzenle
                  </DropdownMenuItem>
                  {permissions.deleteRecords && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => del(r.client)}
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
          <div className="flex items-center gap-3">
            <Avatar name={r.client.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.client.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.client.phone} · {r.cases} dosya
              </p>
            </div>
            {r.fin && <Money value={r.fin.balance} colored className="text-sm font-semibold" />}
          </div>
        )}
      />
    </PageShell>
  );
}
