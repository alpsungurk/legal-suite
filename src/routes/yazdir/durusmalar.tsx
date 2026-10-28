import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useErp } from "@/lib/erp-store";
import { addDays, formatDate, formatDateLong, today } from "@/lib/format";
import {
  DEFAULT_HEARING_ATTENDANCE,
  isExcuseOption,
  isHearingType,
  type Reminder,
} from "@/lib/erp-types";
import { PrintSheet } from "@/components/app/PrintSheet";
import { useFirmLogoUrl } from "@/components/app/Brand";
import { NoAccess } from "@/components/app/bits";
import { Combobox } from "@/components/app/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";
import { downloadHearingsPdf, type HearingPdfDay } from "@/lib/pdf-hearings";
import { talimatActivity } from "@/lib/uyap";

export const Route = createFileRoute("/yazdir/durusmalar")({ component: Page });

const WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const dayOf = (iso: string) => new Date(`${iso}T12:00:00`).getDay();
/** Haftanın pazartesisi */
const mondayOf = (iso: string) => addDays(iso, -((dayOf(iso) + 6) % 7));
/** Seçim kutusunda katılım seçeneklerinin (Mazeret, Tevkil…) değeri; avukatlarda kullanıcı id'si */
const OPTION = "opt:";

/**
 * Haftalık duruşma listesi: gün gün saat, mahkeme, dosya no, müvekkil (sıfatı) ve katılacak avukat.
 * Ekranda katılacak avukat ya da katılım seçeneği (Mazeret, Tevkil… Ayarlar'dan) seçilir, hemen
 * kaydedilir; çıktıda düz metin.
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
  /**
   * "Ön İnceleme · 2026/276" → "Ön İnceleme"; düz "Duruşma" yazılmaz. Talimat dosyası (önceden
   * aktarılmış kayıtlarda notta "Dosya türü: Talimat Dosyası") "Talimat duruşması" olarak belirtilir.
   */
  const activityOf = (r: Reminder) => {
    const first = r.title.split(" · ")[0].trim();
    if (/Dosya türü:.*talimat/i.test(r.note ?? "")) return talimatActivity(first);
    return first && first !== "Duruşma" ? first : undefined;
  };
  // Katılım seçenekleri (Ayarlar → Kategoriler → Duruşma katılımı); uzun ad önce eşleşir
  const attendanceOptions = state.settings.hearingAttendance?.length
    ? state.settings.hearingAttendance
    : DEFAULT_HEARING_ATTENDANCE;
  const byLength = [...attendanceOptions].sort((a, b) => b.length - a.length);
  /**
   * excuse alanı "Seçenek" ya da "Seçenek: açıklama" biçiminde tutulur
   * ("Mazeret (hakim yokluğu)", "Tevkil: Av. Ali Kaya"). Ayarlardan silinmiş ya da formda elle
   * yazılmış değer listede olmasa da kendisi seçenek sayılır.
   */
  const attendanceOf = (r: Reminder) => {
    const excuse = r.excuse?.trim();
    if (!excuse) return undefined;
    const option = byLength.find((o) => excuse === o || excuse.startsWith(`${o}: `));
    if (option) return { option, note: excuse.slice(option.length).replace(/^:\s*/, "") };
    const i = excuse.indexOf(": ");
    return i > 0
      ? { option: excuse.slice(0, i), note: excuse.slice(i + 2) }
      : { option: excuse, note: "" };
  };
  const attendeeText = (r: Reminder) => {
    const a = attendanceOf(r);
    if (!a) return userName(r.assigneeId);
    return a.note ? `${a.option}: ${a.note}` : a.option;
  };
  /** "Mazeret" ile başlayan seçenek: katılınmayacak (kırmızı) */
  const isExcused = (r: Reminder) => isExcuseOption(attendanceOf(r)?.option);
  const canEditRow = (r: Reminder) =>
    permissions.can("reminders", "edit") || r.assigneeId === currentUser.id;

  // Pazartesi–cuma her zaman; hafta sonu yalnızca duruşma varsa. PDF ve yazdırma bunları yan yana basar.
  const columns = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(week, i);
    return {
      date,
      name: WEEKDAYS[dayOf(date)],
      short: formatDate(date).slice(0, 5),
      rows: rows.filter((r) => r.date === date),
    };
  }).filter((d, i) => i < 5 || d.rows.length > 0);
  const days = [...new Set(rows.map((r) => r.date))].map((date) => ({
    date,
    label: `${WEEKDAYS[dayOf(date)]} · ${formatDateLong(date)}`,
    rows: rows.filter((r) => r.date === date),
  }));
  const title = onlyHearings ? "Haftalık duruşma listesi" : "Haftalık ajanda";
  const excuses = rows.filter(isExcused).length;
  const subtitle = [
    `${formatDate(week)} – ${formatDate(weekEnd)}`,
    `${rows.length} kayıt`,
    excuses > 0 && `${excuses} mazeret`,
    assignee && `Avukat: ${userName(assignee)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  /** Avukat seçilince katılım seçeneği kalkar; seçenek seçilince varsa açıklaması korunur */
  const setAttendee = (r: Reminder, value: string) => {
    if (value.startsWith(OPTION)) {
      const option = value.slice(OPTION.length);
      const note = attendanceOf(r)?.note;
      patch("reminders", r.id, { excuse: note ? `${option}: ${note}` : option });
    } else patch("reminders", r.id, { assigneeId: value, excuse: "" });
  };
  const setAttendanceNote = (r: Reminder, note: string) => {
    const option = attendanceOf(r)?.option ?? "Mazeret";
    const next = note.trim() ? `${option}: ${note.trim()}` : option;
    if (next !== r.excuse) patch("reminders", r.id, { excuse: next });
  };

  const download = async () => {
    setBusy(true);
    try {
      const pdfDays: HearingPdfDay[] = columns.map((d) => ({
        label: `${d.name}\n${d.short}`,
        rows: d.rows.map((r) => ({
          time: r.time ?? "—",
          court: r.location ?? "—",
          activity: activityOf(r),
          caseNo: caseNoOf(r),
          parties: partiesOf(r),
          detail: showNotes ? r.note : undefined,
          attendee: attendeeText(r),
          excuse: isExcused(r),
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
      landscape
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
            Katılacak avukatı ya da mazeret, tevkil gibi bir katılım seçeneğini tablodan seçin;
            değişiklik hemen kaydedilir. PDF, günleri yan yana tek yatay sayfaya sığdırır.
            Seçenekleri Ayarlar → Kategoriler → Duruşma katılımı'ndan ekleyip silebilirsiniz.
          </p>
        </div>
      }
      subtitle={<p className="text-[12.5px] text-slate-600">{subtitle}</p>}
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-slate-500">Bu hafta bekleyen duruşma yok.</p>
      ) : (
        <>
          <div
            className="hidden print:grid print:gap-1.5"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((d) => (
              <section key={d.date} className="min-w-0">
                <h2 className="bg-[#143064] px-1 py-1 text-center text-[8px] font-bold leading-tight text-white">
                  {d.name}
                  <span className="block font-normal">{d.short}</span>
                </h2>
                {d.rows.length === 0 ? (
                  <p className="px-1 py-2 text-[8px] text-slate-400">Duruşma yok</p>
                ) : (
                  d.rows.map((r) => (
                    <div key={r.id} className="border-b border-slate-200 px-1 py-1 text-[7.5px] leading-snug">
                      <p className="font-bold text-[#143064]">{r.time ?? "—"}</p>
                      <p>{r.location ?? "—"}</p>
                      {activityOf(r) && <p className="text-slate-500">{activityOf(r)}</p>}
                      <p>{caseNoOf(r)}</p>
                      <p>{partiesOf(r)}</p>
                      {showNotes && r.note && (
                        <p className="whitespace-pre-line text-slate-500">{r.note}</p>
                      )}
                      <p className={isExcused(r) ? "font-medium text-rose-700" : undefined}>
                        {attendeeText(r)}
                      </p>
                    </div>
                  ))
                )}
              </section>
            ))}
          </div>
        <table className="w-full border-collapse text-[12px] print:hidden">
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
                          ? `hidden print:inline ${isExcused(r) ? "font-medium text-rose-700" : ""}`
                          : isExcused(r)
                            ? "font-medium text-rose-700"
                            : undefined
                      }
                    >
                      {attendeeText(r)}
                    </span>
                    {canEditRow(r) &&
                      (() => {
                        const a = attendanceOf(r);
                        // Ayarlardan silinmiş seçenek bu kayıtta seçiliyse listede yine görünür
                        const options =
                          a && !attendanceOptions.includes(a.option)
                            ? [...attendanceOptions, a.option]
                            : attendanceOptions;
                        return (
                          <div className="space-y-1 print:hidden">
                            <select
                              value={a ? `${OPTION}${a.option}` : r.assigneeId}
                              onChange={(e) => setAttendee(r, e.target.value)}
                              aria-label="Katılacak avukat"
                              className={`h-8 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px] ${
                                isExcused(r) ? "font-medium text-rose-700" : ""
                              }`}
                            >
                              <optgroup label="Avukat">
                                {staff.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Katılım">
                                {options.map((o) => (
                                  <option key={o} value={`${OPTION}${o}`}>
                                    {o}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            {a && (
                              <input
                                key={r.excuse}
                                defaultValue={a.note}
                                placeholder="Açıklama (isteğe bağlı)"
                                aria-label="Katılım açıklaması"
                                onBlur={(e) => setAttendanceNote(r, e.target.value)}
                                className="h-8 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[12px]"
                              />
                            )}
                          </div>
                        );
                      })()}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        </>
      )}
    </PrintSheet>
  );
}
