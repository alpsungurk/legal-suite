import { INQUIRY_FIELDS, type EnforcementEvent, type EventData } from "@/lib/erp-types";
import { today } from "@/lib/format";
import { cn } from "@/lib/utils";

/** İşlem kaydındaki ek bilgiler: sorgu sonuçları ve 89/1 banka cevapları */
export function EventDataSummary({ data, className }: { data?: EventData; className?: string }) {
  const inq = data?.inquiry;
  const banks = data?.banks ?? [];
  if (!inq && banks.length === 0) return null;
  return (
    <div className={cn("mt-1.5 space-y-1.5", className)}>
      {inq && (
        <div className="flex flex-wrap gap-1.5">
          {INQUIRY_FIELDS.filter((f) => inq[f.key] != null && inq[f.key] !== "").map((f) => {
            const v = inq[f.key];
            const good = f.kind === "status" ? v === "Aktif" : f.kind === "count" ? Number(v) > 0 : true;
            return (
              <span
                key={f.key}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs",
                  good
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {f.label}: <span className="font-medium">{String(v)}</span>
              </span>
            );
          })}
        </div>
      )}
      {banks.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {banks.map((b, i) => (
            <li key={i} className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{b.name}</span>
              {b.answers.length ? (
                b.answers.map((a) => (
                  <span key={a} className="rounded-full bg-secondary px-2 py-0.5">
                    {a}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                  Cevap bekleniyor
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data?.doneAt && (
        <p className="text-xs text-muted-foreground">Süre tamamlandı olarak işaretlendi</p>
      )}
    </div>
  );
}

/** Süreyi doğuran işlemi "tamamlandı" yapar ya da geri alır (data.doneAt) */
export function doneData(ev: EnforcementEvent, done: boolean): EventData {
  const data: EventData = { ...(ev.data ?? {}) };
  if (done) data.doneAt = today();
  else delete data.doneAt;
  return data;
}
