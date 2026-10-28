/** Dosya / müvekkil sayfasında "bu dosyanın / müvekkilin vekaleti" kartı (yalnızca vekalet izni olanlara) */
import { Lock, Plus } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import type { FeePlan } from "@/lib/erp-types";
import { planSummary } from "@/lib/finance";
import { formatMoney, sumBy } from "@/lib/format";
import { Money, ProgressBar, Section } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { useQuick } from "@/components/forms/quick";

export function VekaletCard({
  plans,
  preset,
  onOpenPlan,
}: {
  /** Bu dosyanın / müvekkilin vekalet planları (adminOnly) */
  plans: FeePlan[];
  /** Yeni vekalet planı açılırken doldurulacak alanlar (müvekkil, dosya, anlaşılan tutar) */
  preset: Partial<FeePlan>;
  onOpenPlan: (id: string) => void;
}) {
  const { permissions } = useErp();
  const quick = useQuick();
  if (!permissions.can("vekalet")) return null;
  const active = plans.filter((p) => !p.cancelled);
  const summaries = active.map(planSummary);
  const total = sumBy(active, (p) => p.total);
  const paid = sumBy(summaries, (s) => s.paid);
  const canCreate = permissions.can("vekalet", "create");
  const open = () =>
    quick.open("plan", {
      preset: { ...preset, adminOnly: true, kind: "Vekalet ücreti" },
      onSaved: (p) => onOpenPlan(p.id),
    });
  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          <Lock className="h-4 w-4 text-muted-foreground" /> Vekalet ücreti
        </span>
      }
      description="Yalnızca vekalet izni olanlar görür"
      actions={
        canCreate && (
          <Button size="sm" variant="outline" onClick={open}>
            <Plus /> Vekalet planı
          </Button>
        )
      }
    >
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu kayıt için vekalet planı yok.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Alınan</span>
              <span>
                <Money value={paid} className="font-semibold" /> /{" "}
                <Money value={total} className="text-muted-foreground" />
              </span>
            </div>
            <ProgressBar value={total ? Math.min(paid / total, 1) : 0} />
            <p className="mt-1 text-xs text-muted-foreground">
              Kalan {formatMoney(Math.max(total - paid, 0))}
            </p>
          </div>
          <ul className="divide-y divide-border/60">
            {plans.map((p) => {
              const s = planSummary(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenPlan(p.id)}
                    className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-primary"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatMoney(s.paid)} / {formatMoney(p.total)}
                      </span>
                    </span>
                    <StatusBadge status={s.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}
