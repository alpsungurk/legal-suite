import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revenueSeries } from "@/lib/mock-data";

const fmt = (v: number) =>
  new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function RevenueChart() {
  return (
    <Card className="h-full min-h-[420px] border-border/60 shadow-soft">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">Son 12 Ay Tahsilat</CardTitle>
          <CardDescription className="text-xs">Aylık toplam tahsilat tutarları</CardDescription>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Toplam</p>
          <p className="text-sm font-semibold">
            {new Intl.NumberFormat("tr-TR", {
              style: "currency",
              currency: "TRY",
              maximumFractionDigits: 0,
            }).format(revenueSeries.reduce((a, b) => a + b.value, 0))}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueSeries} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={fmt}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-accent)", strokeWidth: 1, strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card)",
                }}
                labelStyle={{ color: "var(--color-muted-foreground)", fontWeight: 500 }}
                formatter={(v: number) => [
                  new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    maximumFractionDigits: 0,
                  }).format(v),
                  "Tahsilat",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#revFill)"
                activeDot={{ r: 5, stroke: "var(--color-background)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
