import { CalendarClock, Gavel, HandCoins, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { upcomingReminders } from "@/lib/mock-data";

const typeIcon = {
  Duruşma: Gavel,
  Toplantı: Users2,
  Tahsilat: HandCoins,
  Görev: CalendarClock,
} as const;

export function UpcomingReminders() {
  return (
    <Card className="h-full min-h-[430px] border-border/60 shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Yaklaşan Hatırlatmalar</CardTitle>
        <CardDescription className="text-xs">Duruşma, toplantı ve tahsilat</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {upcomingReminders.map((r, i) => {
          const Icon = typeIcon[r.type as keyof typeof typeIcon] ?? CalendarClock;
          return (
            <div
              key={i}
              className="group flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-border hover:bg-secondary/50"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <div className="flex flex-col items-center leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-wider">
                    {r.month}
                  </span>
                  <span className="text-lg font-bold">{r.day}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {r.type} · {r.time}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
