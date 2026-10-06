import { createFileRoute } from "@tanstack/react-router";
import { useErp } from "@/lib/erp-store";
import { advanceBalance, caseFinance } from "@/lib/finance";
import { formatDate, formatMoney, sumBy } from "@/lib/format";
import { PrintSheet, PrintTable } from "@/components/app/PrintSheet";
import { NoAccess } from "@/components/app/bits";

export const Route = createFileRoute("/yazdir/dosya/$id")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const { state, permissions } = useErp();
  const c = state.cases.find((x) => x.id === id);
  if (!c || !permissions.viewFinance) return <NoAccess />;
  const client = state.clients.find((x) => x.id === c.clientId);
  const expenses = state.expenses
    .filter((e) => e.caseId === c.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const advances = state.advances
    .filter((a) => a.caseId === c.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const fin = caseFinance(state, c.id);
  const adv = client ? advanceBalance(state, client.id) : null;

  return (
    <PrintSheet
      title="Masraf dökümü"
      footerNote={state.settings.firm.statementNote}
      subtitle={
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Dosya
            </p>
            <p className="text-sm font-bold">
              {c.no} · {c.title}
            </p>
            <p className="text-slate-600">{[c.court, c.esasNo].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Müvekkil
            </p>
            <p className="text-sm font-bold">{client?.name}</p>
            {adv && (
              <p className="text-slate-600">
                Güncel avans bakiyesi:{" "}
                <strong className="text-slate-900">{formatMoney(adv.balance)}</strong>
              </p>
            )}
          </div>
        </div>
      }
    >
      <h3 className="mb-2 text-sm font-bold text-[#143064]">Masraflar</h3>
      <PrintTable
        head={["Tarih", "Tür", "Açıklama", "Ödeyen", "Belge", "Tutar"]}
        align={["left", "left", "left", "left", "left", "right"]}
        rows={expenses.map((e) => [
          formatDate(e.date),
          e.type,
          e.title,
          e.paidBy,
          e.receipts.length ? "Var" : "—",
          formatMoney(e.amount),
        ])}
        foot={["", "", "Toplam masraf", "", "", formatMoney(fin.expenseTotal)]}
      />
      {advances.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-bold text-[#143064]">
            Bu dosya için alınan avanslar
          </h3>
          <PrintTable
            head={["Tarih", "İşlem", "Yöntem", "Tutar"]}
            align={["left", "left", "left", "right"]}
            rows={advances.map((a) => [
              formatDate(a.date),
              a.kind,
              a.method,
              formatMoney(a.kind === "Avans" ? a.amount : -a.amount),
            ])}
            foot={[
              "",
              "",
              "Toplam",
              formatMoney(sumBy(advances, (a) => (a.kind === "Avans" ? a.amount : -a.amount))),
            ]}
          />
        </>
      )}
      <div className="avoid-break mt-6 grid grid-cols-3 gap-3 text-center">
        <Box label="Müvekkile yansıyan masraf" value={formatMoney(fin.chargedTotal)} />
        <Box label="Dosyaya alınan avans" value={formatMoney(fin.advanceTotal)} />
        <Box label="Fark" value={formatMoney(fin.advanceTotal - fin.chargedTotal)} />
      </div>
    </PrintSheet>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
