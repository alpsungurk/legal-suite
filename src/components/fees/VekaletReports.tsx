/** Vekalet ücreti raporları: müvekkil bazında toplam, aylık / yıllık gelir */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarRange, TrendingUp, Users } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import type { FeePlan } from "@/lib/erp-types";
import { vekaletByClient, vekaletIncome, vekaletYearly } from "@/lib/finance";
import { formatMoney, formatMoneyCompact, MONTHS_SHORT, sumBy, today } from "@/lib/format";
import { DataTable, type Column } from "@/components/app/DataTable";
import { Money, ProgressBar, Section } from "@/components/app/bits";
import { Segmented } from "@/components/app/fields";
import { StatGrid, StatTile } from "@/components/app/StatTile";

type ClientRow = ReturnType<typeof vekaletByClient>[number];

/** Kime ne kadar vekalet var, ne kadarı alındı */
export function VekaletByClientTab({ plans }: { plans: FeePlan[] }) {
  const { state } = useErp();
  const navigate = useNavigate();
  const rows = useMemo(() => vekaletByClient(plans), [plans]);
  const name = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "—";
  const columns: Column<ClientRow>[] = [
    {
      id: "client",
      header: "Müvekkil",
      sort: (r) => name(r.clientId),
      export: (r) => name(r.clientId),
      cell: (r) => <span className="font-medium">{name(r.clientId)}</span>,
    },
    {
      id: "plans",
      header: "Plan",
      align: "right",
      hideBelow: "md",
      sort: (r) => r.plans,
      export: (r) => r.plans,
      cell: (r) => <span className="text-muted-foreground">{r.plans}</span>,
    },
    {
      id: "total",
      header: "Vekalet toplamı",
      align: "right",
      money: true,
      sort: (r) => r.total,
      export: (r) => r.total,
      cell: (r) => <Money value={r.total} />,
    },
    {
      id: "paid",
      header: "Alınan",
      align: "right",
      money: true,
      sort: (r) => r.paid,
      export: (r) => r.paid,
      cell: (r) => (
        <Money value={r.paid} className="font-semibold text-emerald-600 dark:text-emerald-400" />
      ),
    },
    {
      id: "remaining",
      header: "Kalan",
      align: "right",
      money: true,
      sort: (r) => r.remaining,
      export: (r) => r.remaining,
      cell: (r) => <Money value={r.remaining} className="font-semibold" />,
    },
    {
      id: "overdue",
      header: "Gecikmiş",
      align: "right",
      money: true,
      hideBelow: "lg",
      sort: (r) => r.overdue,
      export: (r) => r.overdue,
      cell: (r) =>
        r.overdue > 0 ? (
          <Money value={r.overdue} className="text-rose-600 dark:text-rose-400" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "progress",
      header: "Alınma",
      hideBelow: "lg",
      export: (r) => `%${r.total ? Math.round((r.paid / r.total) * 100) : 0}`,
      cell: (r) => (
        <div className="w-28">
          <ProgressBar value={r.total ? Math.min(r.paid / r.total, 1) : 0} />
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-3">
      <StatGrid>
        <StatTile
          label="Vekalet toplamı"
          value={formatMoney(sumBy(rows, (r) => r.total))}
          icon={Users}
          tone="blue"
          hint={`${rows.length} müvekkil · ${sumBy(rows, (r) => r.plans)} plan`}
        />
        <StatTile
          label="Alınan"
          value={formatMoney(sumBy(rows, (r) => r.paid))}
          icon={TrendingUp}
          tone="green"
        />
        <StatTile
          label="Kalan"
          value={formatMoney(sumBy(rows, (r) => r.remaining))}
          icon={CalendarRange}
          tone="amber"
          hint={`${formatMoney(sumBy(rows, (r) => r.overdue))} gecikmiş`}
        />
      </StatGrid>
      <DataTable
        rows={rows}
        columns={columns}
        getId={(r) => r.clientId}
        searchText={(r) => [name(r.clientId)]}
        searchPlaceholder="Müvekkil ara..."
        initialSort={{ id: "remaining", desc: true }}
        exportName="Vekalet · müvekkil bazında"
        onRowClick={(r) => navigate({ to: "/muvekkiller/$id", params: { id: r.clientId } })}
        footer={(visible) => (
          <tr>
            <td colSpan={99} className="px-4 py-3 text-right">
              <span className="mr-3 text-xs font-normal text-muted-foreground">
                {visible.length} müvekkil · kalan toplam
              </span>
              <Money value={sumBy(visible, (r) => r.remaining)} />
            </td>
          </tr>
        )}
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{name(r.clientId)}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatMoney(r.paid)} / {formatMoney(r.total)}
              </p>
            </div>
            <Money value={r.remaining} className="font-semibold" />
          </div>
        )}
      />
    </div>
  );
}

type YearRow = ReturnType<typeof vekaletYearly>[number];

/** Aylık vekalet geliri grafiği ve yıllık toplamlar */
export function VekaletIncomeTab({ plans }: { plans: FeePlan[] }) {
  const [range, setRange] = useState("12");
  const data = useMemo(
    () =>
      vekaletIncome(plans, Number(range)).map((r) => ({
        ...r,
        label: MONTHS_SHORT[Number(r.key.slice(5, 7)) - 1],
      })),
    [plans, range],
  );
  const years = useMemo(() => vekaletYearly(plans), [plans]);
  const thisYear = today().slice(0, 4);
  const lastYear = String(Number(thisYear) - 1);
  const yearTotal = (y: string) => years.find((r) => r.year === y)?.income ?? 0;
  const thisMonth = vekaletIncome(plans, 1)[0]?.income ?? 0;
  const yearColumns: Column<YearRow>[] = [
    {
      id: "year",
      header: "Yıl",
      sort: (r) => r.year,
      export: (r) => r.year,
      cell: (r) => <span className="font-medium">{r.year}</span>,
    },
    {
      id: "income",
      header: "Tahsil edilen vekalet",
      align: "right",
      money: true,
      sort: (r) => r.income,
      export: (r) => r.income,
      cell: (r) => <Money value={r.income} className="font-semibold" />,
    },
  ];
  return (
    <div className="space-y-3">
      <StatGrid>
        <StatTile
          label="Bu ay"
          value={formatMoney(thisMonth)}
          icon={CalendarRange}
          tone="green"
          hint="Tahsil edilen vekalet"
        />
        <StatTile
          label={`Bu yıl (${thisYear})`}
          value={formatMoney(yearTotal(thisYear))}
          icon={TrendingUp}
          tone="blue"
        />
        <StatTile
          label={`Geçen yıl (${lastYear})`}
          value={formatMoney(yearTotal(lastYear))}
          icon={TrendingUp}
          tone="violet"
        />
      </StatGrid>
      <Section
        title="Aylık vekalet geliri"
        description="Aylara göre tahsil edilen vekalet ücreti"
        actions={
          <Segmented
            size="sm"
            className="w-auto"
            value={range}
            onChange={setRange}
            options={[
              { value: "12", label: "12 ay" },
              { value: "24", label: "24 ay" },
            ]}
          />
        }
      >
        <div className="h-[260px] w-full">
          <ResponsiveContainer>
            <BarChart
              data={data}
              barCategoryGap="28%"
              margin={{ left: 0, right: 4, top: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => formatMoneyCompact(v)}
              />
              <Tooltip
                cursor={{ fill: "var(--secondary)", opacity: 0.6 }}
                formatter={(v) => [formatMoney(Number(v)), "Vekalet tahsilatı"]}
                labelFormatter={(_, p) => {
                  const k = (p?.[0]?.payload as { key?: string } | undefined)?.key;
                  return k ? `${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : "";
                }}
              />
              <Bar
                dataKey="income"
                name="Vekalet tahsilatı"
                fill="var(--series-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <DataTable
        rows={years}
        columns={yearColumns}
        getId={(r) => r.year}
        initialSort={{ id: "year", desc: true }}
        exportName="Vekalet · yıllık gelir"
        footer={(visible) => (
          <tr>
            <td colSpan={99} className="px-4 py-3 text-right">
              <span className="mr-3 text-xs font-normal text-muted-foreground">Toplam</span>
              <Money value={sumBy(visible, (r) => r.income)} />
            </td>
          </tr>
        )}
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{r.year}</p>
            <Money value={r.income} className="font-semibold" />
          </div>
        )}
      />
    </div>
  );
}
