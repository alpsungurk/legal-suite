import { useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarDays, Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";

const events = [
  {
    date: new Date(2026, 6, 29),
    time: "10:30",
    title: "Duruşma – 2026/128",
    tone: "bg-amber-500",
    kind: "hearing",
  },
  {
    date: new Date(2026, 6, 30),
    time: "14:00",
    title: "Toplantı – Kaya Holding",
    tone: "bg-blue-500",
    kind: "meeting",
  },
  {
    date: new Date(2026, 6, 31),
    time: "09:00",
    title: "Tahsilat hatırlatması – Ayşe Demir",
    tone: "bg-emerald-500",
    kind: "payment",
  },
  {
    date: new Date(2026, 7, 2),
    time: "11:15",
    title: "Duruşma – Ankara 1. İdare",
    tone: "bg-amber-500",
    kind: "hearing",
  },
  {
    date: new Date(2026, 7, 4),
    time: "17:00",
    title: "Bilirkişi raporu teslimi",
    tone: "bg-red-500",
    kind: "critical",
  },
];

export function MiniCalendar() {
  const today = new Date(2026, 6, 28);
  const [selected, setSelected] = useState<Date>(events[0].date);
  const dayEvents = useMemo(
    () => events.filter((event) => isSameDay(event.date, selected)),
    [selected],
  );

  return (
    <Card className="h-full min-h-[430px] border-border/60 shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" /> Takvim
        </CardTitle>
        <CardDescription className="text-xs">
          Hatırlatması olan günler nokta ile işaretlenir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex min-w-0 justify-center overflow-x-auto">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => date && setSelected(date)}
            defaultMonth={today}
            locale={tr}
            modifiers={{
              hearing: events
                .filter((event) => event.kind === "hearing")
                .map((event) => event.date),
              meeting: events
                .filter((event) => event.kind === "meeting")
                .map((event) => event.date),
              payment: events
                .filter((event) => event.kind === "payment")
                .map((event) => event.date),
              critical: events
                .filter((event) => event.kind === "critical")
                .map((event) => event.date),
            }}
            modifiersClassNames={{
              hearing: "calendar-event-amber",
              meeting: "calendar-event-blue",
              payment: "calendar-event-green",
              critical: "calendar-event-red",
            }}
            className="w-fit min-w-[310px] rounded-xl border p-3 [--cell-size:2.25rem] sm:[--cell-size:2.45rem]"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {format(selected, "d MMMM yyyy, EEEE", { locale: tr })}
          </p>
          <div className="space-y-2">
            {dayEvents.length ? (
              dayEvents.map((event) => (
                <div
                  key={`${event.title}-${event.time}`}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/20 p-2.5"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${event.tone}`} />
                  <span className="flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    <Clock3 className="h-3 w-3" />
                    {event.time}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium">{event.title}</span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Bu tarihte planlı hatırlatma bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
