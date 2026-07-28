import { ArrowDownRight, ArrowUpRight, FolderKanban, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stats } from "@/lib/mock-data";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);
const fmtNumber = (v: number) => new Intl.NumberFormat("tr-TR").format(v);

const items = [
  {
    label: "Toplam Müvekkil",
    value: fmtNumber(stats.clients.value),
    delta: stats.clients.delta,
    icon: Users,
    tone: "primary" as const,
  },
  {
    label: "Aktif Dosya",
    value: fmtNumber(stats.activeCases.value),
    delta: stats.activeCases.delta,
    icon: FolderKanban,
    tone: "info" as const,
  },
  {
    label: "Bu Ay Tahsilat",
    value: fmtCurrency(stats.monthRevenue.value),
    delta: stats.monthRevenue.delta,
    icon: Wallet,
    tone: "success" as const,
  },
  {
    label: "Bu Ay Masraf",
    value: fmtCurrency(stats.monthExpense.value),
    delta: stats.monthExpense.delta,
    icon: TrendingDown,
    tone: "warning" as const,
  },
];

const toneStyles: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-accent/10 text-accent",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-[color:var(--warning-foreground)] dark:text-warning",
};

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((s) => {
        const positive = s.delta >= 0;
        return (
          <Card
            key={s.label}
            className="group relative overflow-hidden border-border/60 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="mt-2 truncate text-2xl font-semibold tracking-tight">
                    {s.value}
                  </p>
                </div>
                <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", toneStyles[s.tone])}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                    positive
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                  )}
                >
                  {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(s.delta).toFixed(1)}%
                </span>
                <span className="text-muted-foreground">geçen aya göre</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
