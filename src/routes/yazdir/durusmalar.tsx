import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { addDays, formatDate, formatDateLong, today } from "@/lib/format";
import { isHearingType, type Reminder } from "@/lib/erp-types";
import { PrintSheet } from "@/components/app/PrintSheet";
import { useFirmLogoUrl } from "@/components/app/Brand";
import { NoAccess } from "@/components/app/bits";
import { Combobox } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";
import { downloadHearingsPdf, type HearingPdfDay } from "@/lib/pdf-hearings";

export const Route = createFileRoute("/yazdir/durusmalar")({ component: Page });

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const dayOf = (iso: string) => new Date(`${iso}T12:00:00`).getDay();
/** Haftanın pazartesisi */
const mondayOf = (iso: string) => addDays(iso, -((dayOf(iso) + 6) % 7));
const EXCUSE = "__mazeret";

/**
 * Haftalık duruşma listesi: gün gün saat, mahkeme, dosya no, müvekkil (sıfatı) ve katılacak avukat.
 * Ekranda katılacak avukat seçilir ya da mazeret yazılır (hemen kaydedilir); çıktıda düz metin.
 * Yazdır / PDF ya da doğrudan PDF indir; logolu veya logosuz.
 */
function Page() {
  const { state, permissions, currentUser, patch } = useErp();
  const seeAll = permissions.can("reminders");
  const [week, setWeek] = useState(mondayOf(today()));
  const [assignee, setAssignee] = useState(seeAll ? "" : currentUser.id);
  const [onlyHearings, setOnlyHearings] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [withLogo, setWithLogo] = useState(true);
  const [busy, setBusy] = useState(false);
  const firmLogo = useFirmLogoUrl();
  const weekEnd = addDays(week, 6);

  const rows = useMemo(
    () =>
      state.reminders
        .filter(
          (r) =>
            r.status === "Bekliyor" &&
            r.date >= week &&
            r.date <= weekEnd &&
            (!onlyHearings || isHearingType(r.type)) &&
            (seeAll || r.assigneeId === currentUser.id) &&
            (!assignee || r.assigneeId === assignee),
        )
        .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`)),
    [state.reminders, week, weekEnd, onlyHearings, seeAll, currentUser.id, assignee],
  );
  if (!permissions.can("reminders") && !permissions.can("reminders", "create")) return <NoAccess />;

  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const staff = state.users.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }));
  // Eski / elle girilmiş kayıtlarda ayrı alan yoksa bağlı dava dosyasından ve müvekkilden
  const caseNoOf = (r: Reminder) =>
    r.caseNo || state.cases.find((c) => c.id === r.caseId)?.no || "—";
  const partiesOf = (r: Reminder) =>
    r.parties || state.clients.find((c) => c.id === r.clientId)?.name || "—";
  /** "Ön İnceleme · 2026/276" → "Ön İnceleme"; düz "Duruşma" yazılmaz */
  const activityOf = (r: Reminder) => {
    const first = r.title.split(" · ")[0].trim();
    return first && first !== "Duruşma" ? first : undefined;
  };
  const attendeeText = (r: Reminder) =>
    r.excuse
      ? r.excuse === "Mazeret"
        ? "Mazeret"
        : `Mazeret: ${r.excuse}`
      : userName(r.assigneeId);
  const canEditRow = (r: Reminder) =>
    permissions.can("reminders", "edit") || r.assigneeId === currentUser.id;

  const days = [...new Set(rows.map((r) => r.date))].map((date) => ({
    date,
    label: `${WEEKDAYS[dayOf(date)]} · ${formatDateLong(date)}`,
    rows: rows.filter((r) => r.date === date),
  }));
  const title = onlyHearings ? "Haftalık duruşma listesi" : "Haftalık ajanda";
  const excuses = rows.filter((r) => r.excuse).length;
  const subtitle = [
    `${formatDate(week)} – ${formatDate(weekEnd)}`,
    `${rows.length} kayıt`,
    excuses > 0 && `${excuses} mazeret`,
    assignee && `Avukat: ${userName(assignee)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const setAttendee = (r: Reminder, value: string) => {
    if (value === EXCUSE) patch("reminders", r.id, { excuse: r.excuse || "Mazeret" });
    else patch("reminders", r.id, { assigneeId: value, excuse: "" });
  };

  const download = async () => {
    setBusy(true);
    try {
      const pdfDays: HearingPdfDay[] = days.map((d) => ({
        label: d.label,
        rows: d.rows.map((r) => ({
          time: r.time ?? "—",
          court: r.location ?? "—",
          activity: activityOf(r),
          caseNo: caseNoOf(r),
          parties: partiesOf(r),
          detail: showNotes ? r.note : undefined,
          attendee: attendeeText(r),
          excuse: !!r.excuse,
        })),
      }));
      await downloadHearingsPdf({
        title,
        subtitle,
        firm: state.settings.firm,
        // Logolu: büro logosu, yoksa uygulamanın logosu (yazdırma sayfasıyla aynı)
        logoUrl: withLogo ? (firmLogo ?? BRAND.horizontal) : undefined,
        days: pdfDays,
        filename: `Duruşma listesi ${formatDate(week)}-${formatDate(weekEnd)}${withLogo ? "" : " (logosuz)"}.pdf`,
      });
    } catch (e) {
      toast.error(`PDF oluşturulamadı: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const check = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <label className="flex h-9 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--primary)]"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <PrintSheet
      title={title}
      plainFooter
      showLogo={withLogo}
      actions={
        <Button variant="outline" disabled={busy} onClick={() => void download()}>
          {busy ? <Loader2 className="animate-spin" /> : <Download />} PDF indir
        </Button>
      }
      toolbar={
        <div className="space-y-3 rounded-xl border bg-card p-3 text-sm shadow-soft">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Hafta</span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  aria-label="Önceki hafta"
                  onClick={() => setWeek(addDays(week, -7))}
                >
                  <ChevronLeft />
                </Button>
                <Input
                  type="date"
                  value={week}
                  onChange={(e) => e.target.value && setWeek(mondayOf(e.target.value))}
                  className="h-9 w-auto"
                  aria-label="Haftanın bir günü"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  aria-label="Sonraki hafta"
                  onClick={() => setWeek(addDays(week, 7))}
                >
                  <ChevronRight />
                </Button>
                <Button variant="ghost" className="h-9" onClick={() => setWeek(mondayOf(today()))}>
                  Bu hafta
                </Button>
              </div>
            </div>
            {seeAll && (
              <div className="w-56 space-y-1">
                <span className="block text-xs font-medium text-muted-foreground">Avukat</span>
                <Combobox
                  value={assignee || undefined}
                  onChange={setAssignee}
                  options={staff}
                  placeholder="Tümü"
                  allowClear
                />
              </div>
            )}
            {check("Yalnızca duruşma ve keşif", onlyHearings, setOnlyHearings)}
            {check("Taraflar ve notlar", showNotes, setShowNotes)}
            {check("Logolu", withLogo, setWithLogo)}
          </div>
          <p className="text-xs text-muted-foreground">
            Katılacak avukatı ya da mazereti tablodan seçin; değişiklik hemen kaydedilir. Çıktıda
            yalnızca seçilen avukatın adı ya da “Mazeret” yazar.
          </p>
        </div>
      }
      subtitle={<p className="text-[12.5px] text-slate-600">{subtitle}</p>}
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-slate-500">Bu hafta bekleyen duruşma yok.</p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#143064] text-left text-white">
              <th className="w-[52px] px-2 py-2 font-semibold">Saat</th>
              <th className="px-2 py-2 font-semibold">Mahkeme</th>
              <th className="w-[78px] px-2 py-2 font-semibold">Dosya no</th>
              <th className="px-2 py-2 font-semibold">Müvekkil (sıfatı)</th>
              <th className="w-[150px] px-2 py-2 font-semibold">Katılacak avukat</th>
            </tr>
          </thead>
          {days.map((d) => (
            <tbody key={d.date}>
              <tr className="avoid-break bg-[#e8eef7]">
                <td colSpan={5} className="px-2 py-1.5 font-bold text-[#143064]">
                  {d.label}
                </td>
              </tr>
              {d.rows.map((r) => (
                <tr key={r.id} className="avoid-break border-b border-slate-200 align-top">
                  <td className="px-2 py-2 font-semibold">{r.time ?? "—"}</td>
                  <td className="px-2 py-2">
                    {r.location ?? "—"}
                    {activityOf(r) && (
                      <span className="block text-[11px] text-slate-500">{activityOf(r)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">{caseNoOf(r)}</td>
                  <td className="px-2 py-2">
                    {partiesOf(r)}
                    {showNotes && r.note && (
                      <span className="mt-0.5 block whitespace-pre-line text-[11px] text-slate-500">
                        {r.note}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        canEditRow(r)
                          ? "hidden print:inline"
                          : r.excuse
                            ? "font-medium text-rose-700"
                            : undefined
                      }
                    >
                      {attendeeText(r)}
                    </span>
                    {canEditRow(r) && (
                      <div className="space-y-1 print:hidden">
                        <select
                          value={r.excuse ? EXCUSE : r.assigneeId}
                          onChange={(e) => setAttendee(r, e.target.value)}
                          aria-label="Katılacak avukat"
                          className={`h-8 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px] ${
                            r.excuse ? "font-medium text-rose-700" : ""
                          }`}
                        >
                          {staff.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                          <option value={EXCUSE}>Mazeret</option>
                        </select>
                        {r.excuse && (
                          <input
                            key={r.excuse}
                            defaultValue={r.excuse === "Mazeret" ? "" : r.excuse}
                            placeholder="Mazeret açıklaması (isteğe bağlı)"
                            aria-label="Mazeret açıklaması"
                            onBlur={(e) => {
                              const v = e.target.value.trim() || "Mazeret";
                              if (v !== r.excuse) patch("reminders", r.id, { excuse: v });
                            }}
                            className="h-8 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px]"
                          />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
    </PrintSheet>
  );
}
