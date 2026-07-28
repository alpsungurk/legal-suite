import { AlertTriangle, CheckCircle2, Clock, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { notifications } from "@/lib/mock-data";

const toneMap = {
  success: { icon: CheckCircle2, cls: "bg-success/15 text-success" },
  info: { icon: Info, cls: "bg-accent/15 text-accent" },
  warning: { icon: AlertTriangle, cls: "bg-warning/15 text-warning" },
  destructive: { icon: XCircle, cls: "bg-destructive/15 text-destructive" },
} as const;

export function NotificationsPanel() {
  return (
    <Card className="h-full min-h-[430px] border-border/60 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">Bildirimler</CardTitle>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {notifications.length} yeni
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.map((n, i) => {
          const t = toneMap[n.tone];
          const Icon = t.icon;
          return (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
            >
              <div
                className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", t.cls)}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {n.time}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
