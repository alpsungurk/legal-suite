/** Çöpe atılan (ya da atılacak) kayıtların tutarları ve tek tek dökümü */
import { formatDate, formatMoney } from "@/lib/format";
import { MONEY_LABELS, TRASH_LABELS, type TrashLine, type TrashMoney } from "@/lib/trash";

/** "İcra tahsilatı ₺150,00 · Masraf ₺90,00" */
export function describeMoney(money: TrashMoney) {
  return Object.entries(money)
    .filter(([t, n]) => n > 0 && MONEY_LABELS[t])
    .map(([t, n]) => `${MONEY_LABELS[t]} ${formatMoney(n)}`)
    .join(" · ");
}

/** Tutar toplamları ve her kaydın satırı; uzun listede kaydırılır */
export function TrashDetails({ money, items }: { money: TrashMoney; items: TrashLine[] }) {
  const totals = Object.entries(money).filter(([t, n]) => n > 0 && MONEY_LABELS[t]);
  return (
    <span className="block space-y-2 text-left">
      {totals.length > 0 && (
        <span className="block rounded-md bg-secondary/60 px-3 py-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tutarlar
          </span>
          {totals.map(([t, n]) => (
            <span key={t} className="flex items-center justify-between gap-3 text-sm">
              <span>{MONEY_LABELS[t]}</span>
              <b className="money text-foreground">{formatMoney(n)}</b>
            </span>
          ))}
        </span>
      )}
      {items.length > 0 && (
        <span className="block max-h-48 overflow-y-auto rounded-md border border-border/70 px-3 py-1">
          {items.map((i, idx) => (
            <span
              key={idx}
              className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 text-xs last:border-0"
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{TRASH_LABELS[i.t] ?? i.t}</span>
                {i.label ? ` · ${i.label}` : ""}
                {i.date ? ` · ${formatDate(i.date)}` : ""}
              </span>
              {i.amount != null && (
                <b className="money shrink-0 text-foreground">{formatMoney(Number(i.amount))}</b>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
