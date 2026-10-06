import { createFileRoute, Link } from "@tanstack/react-router";
import { PiggyBank, Printer, Receipt, Wallet } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { clientFinance } from "@/lib/finance";
import { formatIban, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/app/PageHeader";
import { NoAccess } from "@/components/app/bits";
import { StatGrid, StatTile } from "@/components/app/StatTile";
import { Button } from "@/components/ui/button";
import { LedgerTable } from "@/components/lists/tables";
import { usePortalData } from "@/routes/portal/-data";

export const Route = createFileRoute("/portal/ekstre")({
  head: () => ({ meta: [{ title: "Hesap ekstresi — Müvekkil portalı" }] }),
  component: Page,
});

function Page() {
  const { state } = useErp();
  const { client } = usePortalData();
  if (!client?.portalShowStatement) return <NoAccess />;
  const fin = clientFinance(state, client.id);
  const firm = state.settings.firm;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesap ekstresi"
        description="Masraf avansı, masraflar, ücretler ve ödemeleriniz"
        icon={Receipt}
        actions={
          <Button variant="outline" asChild>
            <Link to="/yazdir/ekstre/$id" params={{ id: client.id }} target="_blank">
              <Printer /> PDF indir
            </Link>
          </Button>
        }
      />
      <StatGrid className="lg:grid-cols-3">
        <StatTile
          label="Bakiye"
          value={formatMoney(Math.abs(fin.balance))}
          icon={Receipt}
          tone={fin.balance > 0 ? "amber" : "green"}
          hint={
            fin.balance > 0.005
              ? "Ödenecek tutar"
              : fin.balance < -0.005
                ? "Lehinize"
                : "Hesap kapalı"
          }
        />
        <StatTile
          label="Masraf avansı kalan"
          value={formatMoney(fin.advance.balance)}
          icon={PiggyBank}
          tone="blue"
          hint={`${formatMoney(fin.advance.spent)} masraf yapıldı`}
        />
        <StatTile
          label="Kalan ücret"
          value={formatMoney(fin.feeRemaining)}
          icon={Wallet}
          tone="violet"
          hint={fin.feeOverdue ? `${formatMoney(fin.feeOverdue)} vadesi geçti` : undefined}
          hintTone="red"
        />
      </StatGrid>
      {fin.balance > 0.005 && firm.iban && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 text-sm shadow-soft animate-fade-up">
          <p className="font-semibold">Ödeme bilgileri</p>
          <p className="mt-1 text-muted-foreground">
            {firm.bankName} ·{" "}
            <span className="font-mono text-foreground">{formatIban(firm.iban)}</span> · Alıcı:{" "}
            {firm.legalName}
          </p>
        </div>
      )}
      <LedgerTable clientId={client.id} />
    </div>
  );
}
