import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileWarning, Plus, Receipt, Building2, Users } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { formatMoney, sumBy, today } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { PageShell } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Segmented } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { ExpenseTable } from "@/components/lists/tables";
import { useQuick } from "@/components/forms/quick";

export const Route = createFileRoute("/masraflar")({
  head: () => ({ meta: [{ title: "Masraflar — Lex Yönetim" }] }),
  component: Page,
});

function Page() {
  const { state, currentUser, permissions } = useErp();
  const quick = useQuick();
  const [scope, setScope] = useState(permissions.viewFinance ? "all" : "mine");
  const [kind, setKind] = useState("all");

  const visible = state.expenses.filter(
    (e) =>
      (scope === "all" || e.createdBy === currentUser.id) &&
      (kind === "all" || e.chargeTo === kind),
  );
  const monthStart = `${today().slice(0, 7)}-01`;
  const month = visible.filter((e) => e.date >= monthStart);
  const undocumented = visible.filter((e) => !e.receipts.length);

  return (
    <PageShell>
      <PageHeader
        title="Masraflar"
        description="Dosya masrafları ve büro giderleri · makbuz ve belgeleriyle"
        icon={Receipt}
        actions={
          permissions.addExpense && (
            <Button onClick={() => quick.open("expense")}>
              <Plus /> Yeni masraf
            </Button>
          )
        }
      />
      <StatGrid>
        <StatTile
          label="Bu ay"
          value={formatMoney(sumBy(month, (e) => e.amount))}
          icon={Receipt}
          tone="amber"
          hint={`${month.length} kalem`}
        />
        <StatTile
          label="Müvekkile yansıyan"
          value={formatMoney(
            sumBy(
              visible.filter((e) => e.chargeTo === "Müvekkil"),
              (e) => e.amount,
            ),
          )}
          icon={Users}
          tone="blue"
          hint="Avanstan düşülen / cariye yazılan"
        />
        <StatTile
          label="Büro giderleri"
          value={formatMoney(
            sumBy(
              visible.filter((e) => e.chargeTo === "Büro"),
              (e) => e.amount,
            ),
          )}
          icon={Building2}
          tone="violet"
        />
        <StatTile
          label="Belgesiz"
          value={undocumented.length}
          icon={FileWarning}
          tone={undocumented.length ? "red" : "green"}
          hint={
            undocumented.length
              ? `${formatMoney(sumBy(undocumented, (e) => e.amount))} makbuz bekliyor`
              : "Tüm masraflar belgeli"
          }
          hintTone={undocumented.length ? "red" : "green"}
        />
      </StatGrid>
      <div className="flex flex-wrap items-center gap-2">
        {permissions.viewFinance && (
          <Segmented
            className="w-auto"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "Tüm masraflar" },
              { value: "mine", label: "Benim girdiklerim" },
            ]}
          />
        )}
        <Segmented
          className="w-auto"
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "Hepsi" },
            { value: "Müvekkil", label: "Dosya masrafı" },
            { value: "Büro", label: "Büro gideri" },
          ]}
        />
      </div>
      <ExpenseTable rows={visible} />
    </PageShell>
  );
}
