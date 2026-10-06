import { ArrowRight, Bell, FolderOpen, UserRound, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { activeReminders, pendingCollections, recentCases, recentClients } from "@/lib/mock-data";
import { useErp } from "@/lib/erp-store";

const fmt = (v: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(v);

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-soft transition-shadow hover:shadow-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-xs font-semibold sm:text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <button className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          Tümü <ArrowRight className="h-3 w-3" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

export function BottomSummary() {
  const { permissions } = useErp();
  return (
    <div
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${permissions.canViewFinance ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
    >
      <SectionCard title="Son Eklenen Müvekkiller" icon={UserRound}>
        {recentClients.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between gap-2 rounded-md p-1.5 hover:bg-secondary/50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.cases} dosya</p>
            </div>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {c.tag}
            </Badge>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Son Açılan Dosyalar" icon={FolderOpen}>
        {recentCases.map((c) => (
          <div key={c.no} className="rounded-md p-1.5 hover:bg-secondary/50">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{c.title}</p>
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                {c.no}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{c.client}</span>
            </div>
          </div>
        ))}
      </SectionCard>

      {permissions.canViewFinance && (
        <SectionCard title="Bekleyen Tahsilatlar" icon={Wallet}>
          {pendingCollections.map((p) => (
            <div
              key={p.file}
              className="flex items-center justify-between gap-2 rounded-md p-1.5 hover:bg-secondary/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.client}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {p.file} · {p.due}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  p.overdue ? "text-destructive" : "text-foreground",
                )}
              >
                {fmt(p.amount)}
              </span>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Aktif Hatırlatmalar" icon={Bell}>
        {activeReminders.map((r, i) => {
          const cls =
            r.tone === "warning"
              ? "bg-warning/15 text-warning"
              : r.tone === "destructive"
                ? "bg-destructive/15 text-destructive"
                : "bg-accent/15 text-accent";
          return (
            <div key={i} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-secondary/50">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", cls)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.when}</p>
              </div>
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
}
