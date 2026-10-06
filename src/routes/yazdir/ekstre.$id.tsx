import { createFileRoute } from "@tanstack/react-router";
import { useErp } from "@/lib/erp-store";
import { clientFinance, clientLedger } from "@/lib/finance";
import { formatDate, formatMoney, sumBy } from "@/lib/format";
import { PrintSheet, PrintTable } from "@/components/app/PrintSheet";
import { NoAccess } from "@/components/app/bits";

type Search = { from?: string; to?: string };

export const Route = createFileRoute("/yazdir/ekstre/$id")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { from, to } = Route.useSearch();
  const { state, permissions, currentUser } = useErp();
  const client = state.clients.find((c) => c.id === id);
  const allowed =
    permissions.viewFinance ||
    (permissions.isPortal && currentUser.clientId === id && !!client?.portalShowStatement);
  if (!client || !allowed) return <NoAccess />;

  const { entries, opening, closing } = clientLedger(state, id, { from, to });
  const fin = clientFinance(state, id);
  const caseNo = (cid?: string) => state.cases.find((c) => c.id === cid)?.no ?? "";
  const bal = (n: number) =>
    `${formatMoney(Math.abs(n))} ${n > 0.005 ? "(B)" : n < -0.005 ? "(A)" : ""}`;

  return (
    <PrintSheet
      title="Cari hesap ekstresi"
      footerNote={state.settings.firm.statementNote}
      subtitle={
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Müvekkil
            </p>
            <p className="text-sm font-bold">{client.name}</p>
            {client.identity && (
              <p className="text-slate-600">
                {client.kind === "Kurumsal" ? "VKN" : "TCKN"}: {client.identity}
              </p>
            )}
            {client.address && <p className="text-slate-600">{client.address}</p>}
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Dönem
            </p>
            <p className="text-sm font-bold">
              {from ? formatDate(from) : "Başlangıç"} – {to ? formatDate(to) : "Bugün"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 text-slate-600">
              <span>Masraf avansı</span>
              <span className="text-right font-medium text-slate-900">
                {formatMoney(fin.advance.balance)}
              </span>
              <span>Ücret alacağı</span>
              <span className="text-right font-medium text-slate-900">
                {formatMoney(fin.feeRemaining)}
              </span>
            </div>
          </div>
        </div>
      }
    >
      <PrintTable
        head={["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"]}
        align={["left", "left", "left", "right", "right", "right"]}
        rows={[
          ...(from ? [["", "Devir", "Önceki dönemden devreden", "", "", bal(opening)]] : []),
          ...entries.map((e) => [
            formatDate(e.date),
            e.kind,
            <>
              {e.description}
              {e.caseId && <span className="text-slate-500"> · {caseNo(e.caseId)}</span>}
            </>,
            e.debit ? formatMoney(e.debit) : "",
            e.credit ? formatMoney(e.credit) : "",
            bal(e.balance),
          ]),
        ]}
        foot={[
          "",
          "",
          "Toplam",
          formatMoney(sumBy(entries, (e) => e.debit)),
          formatMoney(sumBy(entries, (e) => e.credit)),
          bal(closing),
        ]}
      />
      <div className="avoid-break mt-6 rounded-lg bg-slate-50 p-4 text-sm">
        <p>
          {formatDate(to ?? new Date().toISOString().slice(0, 10))} itibarıyla hesap bakiyesi:{" "}
          <strong>{formatMoney(Math.abs(closing))}</strong>{" "}
          {closing > 0.005
            ? "müvekkil borcudur."
            : closing < -0.005
              ? "müvekkil alacağıdır."
              : "(hesap kapalı)."}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          (B): Müvekkil borçlu · (A): Müvekkil alacaklı
        </p>
      </div>
    </PrintSheet>
  );
}
