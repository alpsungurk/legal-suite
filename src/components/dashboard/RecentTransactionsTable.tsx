import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { recentTransactions, type TxStatus } from "@/lib/mock-data";

const statusStyle: Record<TxStatus, string> = {
  Tamamlandı: "bg-success/15 text-success border-transparent",
  Beklemede:
    "bg-warning/15 text-[color:var(--warning-foreground)] dark:text-warning border-transparent",
  İptal: "bg-destructive/15 text-destructive border-transparent",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(v);

export function RecentTransactionsTable() {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">Son İşlemler</CardTitle>
        <CardDescription className="text-xs">Son 10 tahsilat ve masraf hareketi</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-xs uppercase tracking-wider">Tarih</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Tür</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Müvekkil</TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Dosya</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">Tutar</TableHead>
                <TableHead className="pr-6 text-right text-xs uppercase tracking-wider">
                  Durum
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions.map((t) => {
                const negative = t.amount < 0;
                return (
                  <TableRow key={t.id} className="border-border/60">
                    <TableCell className="pl-6 py-3 text-sm text-muted-foreground tabular-nums">
                      {t.date}
                    </TableCell>
                    <TableCell className="py-3 text-sm font-medium">{t.type}</TableCell>
                    <TableCell className="py-3 text-sm">{t.client}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                      {t.file}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "py-3 text-right text-sm font-semibold tabular-nums",
                        negative ? "text-destructive" : "text-success",
                      )}
                    >
                      {negative ? "-" : "+"}
                      {fmt(Math.abs(t.amount))}
                    </TableCell>
                    <TableCell className="pr-6 py-3 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          statusStyle[t.status],
                        )}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
