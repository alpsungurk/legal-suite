import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { expenseBreakdown } from "@/lib/mock-data";

const COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
];

const fmtTRY = (v: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(v);

export function ExpensePieChart() {
  const total = expenseBreakdown.reduce((a, b) => a + b.value, 0);

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Masraf Dağılımı</CardTitle>
        <CardDescription className="text-xs">Bu ay kategori bazlı</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-card)",
                  }}
                  formatter={(v: number, n) => [fmtTRY(v), n as string]}
                />
                <Pie
                  data={expenseBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                >
                  {expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Toplam</span>
              <span className="text-sm font-semibold">{fmtTRY(total)}</span>
            </div>
          </div>

          <ul className="w-full space-y-2">
            {expenseBreakdown.map((it, i) => {
              const pct = ((it.value / total) * 100).toFixed(1);
              return (
                <li key={it.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{it.name}</span>
                  <span className="text-muted-foreground tabular-nums">%{pct}</span>
                  <span className="w-20 text-right font-medium tabular-nums">{fmtTRY(it.value)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
