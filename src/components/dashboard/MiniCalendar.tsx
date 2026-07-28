import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { tr } from "date-fns/locale";

export function MiniCalendar() {
  const today = new Date();
  const events = [
    { time: "10:30", title: "Duruşma – 2026/128" },
    { time: "14:00", title: "Toplantı – Kaya Holding" },
    { time: "17:00", title: "Evrak teslimi – Ali Yıldız" },
  ];

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Takvim</CardTitle>
        <CardDescription className="text-xs">Bugünkü etkinlikler</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={today}
            locale={tr}
            className="rounded-lg border p-2"
          />
        </div>
        <div className="space-y-1.5">
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                {e.time}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
