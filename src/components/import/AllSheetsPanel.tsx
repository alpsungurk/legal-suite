/** Çok sayfalı icra Excel'i: her sayfanın nereye gideceği ve sonucu; hepsi tek seferde aktarılır. */
import { AlertTriangle, ArrowLeft, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { downloadWorkbook } from "@/lib/excel";
import { IMPORT_SPECS } from "@/lib/import-specs";
import { REQUIRED_MARK } from "@/lib/import-template";
import { Combobox } from "@/components/app/fields";
import { cn } from "@/lib/utils";
import { SHEET_ROLE_LABEL, type SheetResult, type SheetRole } from "@/lib/import-workbook";

function destination(r: SheetResult) {
  switch (r.plan.role) {
    case "alacakli":
      return "Alacaklı olduğumuz";
    case "borclu":
      return "Borçlu olduğumuz";
    case "sirket":
      return `Şirket: ${r.plan.company}`;
    default:
      return "Aktarılmaz";
  }
}

/** Sayfa için veri kaybı uyarıları: sessizce düşen bir şey olmasın */
function notices(r: SheetResult): Array<{ text: string; danger?: boolean }> {
  const out: Array<{ text: string; danger?: boolean }> = [];
  const { plan } = r;
  const unknown = Object.entries(plan.unknownFilled ?? {});
  if (unknown.length)
    out.push({
      text: `Tanınmayan sütunlar dosya notuna "Ek sütunlar" olarak eklendi: ${unknown
        .map(([h, n]) => `${h} (${n} hücre)`)
        .join(", ")}`,
    });
  if (plan.truncated)
    out.push({
      text: "Sayfada 5000'den fazla satır var; fazlası okunmadı. Dosyayı bölüp ayrı yükleyin.",
      danger: true,
    });
  else if (plan.dataRows != null && plan.dataRows !== plan.rows.length)
    out.push({
      text: `Excel'de ${plan.dataRows} dolu satır var, ${plan.rows.length} satır okundu.`,
      danger: true,
    });
  if (plan.role === "atla" && plan.raw?.length)
    out.push({ text: `${plan.raw.length} satır içerik aktarılmıyor (indirilebilir).` });
  return out;
}

export function AllSheetsPanel({
  fileName,
  results,
  busy,
  onBack,
  onOpenSheet,
  onChangePlan,
  clientNames,
  onImport,
}: {
  fileName: string;
  results: SheetResult[];
  busy: boolean;
  onBack: () => void;
  onOpenSheet: (r: SheetResult) => void;
  /** Sayfa türü / şirket değiştirildi (sayfa yeniden okunur) */
  onChangePlan: (index: number, role: SheetRole, company?: string) => void;
  clientNames: string[];
  onImport: () => void;
}) {
  const pending = results.filter((r) => r.plan.pending).length;
  const ready = results.reduce((n, r) => n + r.ok, 0);
  const updates = results.reduce((n, r) => n + r.update, 0);
  const failed = results.reduce((n, r) => n + r.error, 0);
  const existing = results.reduce((n, r) => n + r.existing, 0);
  const rejected = results.flatMap((r) => r.rejected);
  const skippedSheets = results.filter((r) => r.plan.role === "atla" && r.plan.raw?.length);

  /** Aktarılmayan her şey tek dosyada: hatalı / tekrar / kayıtlı satırlar ve atlanan sayfaların içeriği */
  const downloadSkipped = () => {
    const cols = IMPORT_SPECS.enforcements.columns;
    downloadWorkbook("Aktarılmayanlar", [
      {
        name: "Aktarılmayan satırlar",
        columns: [
          { header: "Sayfa", width: 24 },
          { header: "Excel satırı", width: 12 },
          { header: "Neden", width: 60 },
          ...cols.map((c) => ({
            header: c.required ? c.header + REQUIRED_MARK : c.header,
            width: c.width ?? 20,
          })),
        ],
        rows: rejected.map((x) => [
          x.sheet.trim(),
          x.line,
          x.reason,
          ...cols.map((c) => x.values[c.key] ?? ""),
        ]),
      },
      ...(skippedSheets.length
        ? [
            {
              name: "Atlanan sayfalar",
              columns: [
                { header: "Sayfa", width: 24 },
                { header: "İçerik", width: 120 },
              ],
              rows: skippedSheets.flatMap((r) =>
                (r.plan.raw ?? []).map((line) => [r.plan.name.trim(), line]),
              ),
            },
          ]
        : []),
    ]);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="slate" dot={false}>
            {results.filter((r) => r.plan.role !== "atla").length} sayfa
          </StatusBadge>
          <StatusBadge tone="green">{ready} hazır</StatusBadge>
          {failed > 0 && <StatusBadge tone="red">{failed} hatalı</StatusBadge>}
          {updates > 0 && <StatusBadge tone="blue">{updates} güncellenecek</StatusBadge>}
          {existing > 0 && (
            <StatusBadge tone="amber">{existing} kayıtlı, değişiklik yok</StatusBadge>
          )}
          <p className="ml-auto text-xs text-muted-foreground">{fileName}</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-secondary/50 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Sayfa</th>
                <th className="px-3 py-2">Nereye aktarılacak</th>
                <th className="px-3 py-2 text-right">Satır</th>
                <th className="px-3 py-2 text-right">Yeni</th>
                <th className="px-3 py-2 text-right">Güncellenecek</th>
                <th className="px-3 py-2 text-right">Değişiklik yok</th>
                <th className="px-3 py-2 text-right">Hatalı</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((r, index) => {
                const skipped = r.plan.role === "atla" || !!r.plan.pending;
                // Satırı olan her sayfanın türü değiştirilebilir (bilgi sayfaları hariç)
                const editable = r.plan.rows.length > 0;
                return (
                  <tr
                    key={r.plan.name}
                    className={cn(
                      "border-t border-border/60 align-top",
                      r.plan.pending && "bg-rose-50/50 dark:bg-rose-950/15",
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium">{r.plan.name.trim()}</td>
                    <td className="px-3 py-2.5">
                      {editable ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`${r.plan.name.trim()} sayfasının türü`}
                            value={r.plan.needsRole ? "" : r.plan.role}
                            onChange={(e) => onChangePlan(index, e.target.value as SheetRole)}
                            className={cn(
                              "h-9 rounded-md border bg-background px-2 text-sm",
                              r.plan.pending ? "border-destructive" : "border-input",
                            )}
                          >
                            {r.plan.needsRole && (
                              <option value="" disabled>
                                Tür seçin…
                              </option>
                            )}
                            {(Object.keys(SHEET_ROLE_LABEL) as SheetRole[]).map((k) => (
                              <option key={k} value={k}>
                                {SHEET_ROLE_LABEL[k]}
                              </option>
                            ))}
                          </select>
                          {r.plan.role === "sirket" && (
                            <div className="min-w-[260px] flex-1">
                              <Combobox
                                value={r.plan.company || undefined}
                                onChange={(v) => onChangePlan(index, "sirket", v)}
                                options={clientNames.map((n) => ({ value: n, label: n }))}
                                placeholder="Kayıtlı müvekkil şirketi seçin"
                                invalid={!!r.plan.pending}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{destination(r)}</p>
                      )}
                      {r.plan.role === "sirket" && r.ok > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {r.alacakli} alacaklı · {r.borclu} borçlu olduğumuz dosya
                        </p>
                      )}
                      {skipped && r.plan.reason && (
                        <p className="text-xs text-muted-foreground">{r.plan.reason}</p>
                      )}
                      {notices(r).map((n) => (
                        <p
                          key={n.text}
                          className={
                            n.danger
                              ? "mt-0.5 flex items-start gap-1 text-xs font-medium text-destructive"
                              : "mt-0.5 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400"
                          }
                        >
                          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                          {n.text}
                        </p>
                      ))}
                      {r.changes.map((c) => (
                        <p key={c} className="mt-0.5 text-xs text-blue-700 dark:text-blue-400">
                          {c}
                        </p>
                      ))}
                      {r.update > r.changes.length && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          … ve {r.update - r.changes.length} dosyada daha değişiklik
                        </p>
                      )}
                      {r.problems.map((p) => (
                        <p key={p} className="mt-0.5 text-xs text-destructive">
                          {p}
                        </p>
                      ))}
                      {r.error > r.problems.length && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          … ve {r.error - r.problems.length} hata daha
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {skipped ? "" : r.total}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {skipped ? "" : r.ok}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-blue-700 dark:text-blue-400">
                      {skipped ? "" : r.update || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {skipped ? "" : r.existing || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-destructive">
                      {skipped ? "" : r.error || ""}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {!skipped && (
                        <Button variant="ghost" size="sm" onClick={() => onOpenSheet(r)}>
                          İncele
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <p className="min-w-[280px] flex-1 text-xs leading-5 text-muted-foreground">
            Yeni dosyalar ve güncellemeler tek seferde yazılır. Kayıtlı dosyada yalnızca Excel'de
            değişen bilgi güncellenir: boş hücre mevcut değeri silmez, açıklamalara yalnızca yeni
            satırlar eklenir, son haciz tarihi geri alınmaz, işlem geçmişine dokunulmaz. Hatalı
            satırlar atlanır; hatalıları düzeltmek için sayfanın yanındaki{" "}
            <span className="font-medium">İncele</span>
            'yi kullanın. Aynı dosya iki sayfada varsa dolu olan alınır. Yeni müvekkil ve karşı
            taraf kartları otomatik açılır. Tanınmayan sütunlardaki bilgi dosya notuna eklenir,
            hiçbir hücre sessizce düşmez.
          </p>
          {(rejected.length > 0 || skippedSheets.length > 0) && (
            <Button variant="outline" size="sm" onClick={downloadSkipped}>
              <Download /> Aktarılmayanları Excel'e indir ({rejected.length + skippedSheets.length})
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-6 py-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft /> Sayfa sayfa gözden geçir
        </Button>
        {pending > 0 && (
          <p className="ml-auto text-xs font-medium text-destructive">
            {pending} sayfa için seçim bekleniyor (türünü seçin ya da "Aktarma" deyin)
          </p>
        )}
        <Button disabled={busy || pending > 0 || ready + updates === 0} onClick={onImport}>
          <Upload />{" "}
          {updates ? `${ready} yeni · ${updates} güncelleme aktar` : `${ready} icra dosyası aktar`}
        </Button>
      </div>
    </>
  );
}
