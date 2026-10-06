import { HandCoins, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useErp } from "@/lib/erp-store";
import {
  installmentPaid,
  installmentRemaining,
  installmentStatus,
  planSummary,
} from "@/lib/finance";
import { formatDate, relativeDue } from "@/lib/format";
import { Money, ProgressBar, TextLink } from "@/components/app/bits";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useQuick } from "@/components/forms/quick";
import { useConfirm } from "@/components/app/confirm";
import { cn } from "@/lib/utils";

/** Tahsilat planı detayı: taksitler, ödemeler, tahsilat alma. */
export function PlanSheet({
  planId,
  onOpenChange,
}: {
  planId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, permissions, removeInstallmentPayment } = useErp();
  const quick = useQuick();
  const confirm = useConfirm();
  const plan = state.plans.find((p) => p.id === planId);
  const s = plan ? planSummary(plan) : null;
  const client = state.clients.find((c) => c.id === plan?.clientId);
  const kase = state.cases.find((c) => c.id === plan?.caseId);
  const account = (id?: string) => state.accounts.find((a) => a.id === id)?.name;

  return (
    <Sheet open={!!plan} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        {plan && s && (
          <>
            <SheetHeader className="space-y-3 border-b border-border/60 p-6 text-left">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">{plan.title}</SheetTitle>
                  <SheetDescription className="mt-1">
                    {client && <TextLink to={`/muvekkiller/${client.id}`}>{client.name}</TextLink>}
                    {kase && (
                      <>
                        {" · "}
                        <TextLink to={`/dosyalar/${kase.id}`}>{kase.no}</TextLink>
                      </>
                    )}
                  </SheetDescription>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-secondary/50 p-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Toplam</p>
                  <Money value={plan.total} className="text-sm font-semibold" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Tahsil edilen</p>
                  <Money
                    value={s.paid}
                    className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Kalan</p>
                  <Money value={s.remaining} className="text-sm font-semibold" />
                </div>
              </div>
              <ProgressBar
                value={s.progress}
                tone={
                  s.status === "Gecikmiş" ? "red" : s.status === "Tamamlandı" ? "green" : "primary"
                }
              />
              {permissions.manageFinance && (
                <div className="flex gap-2">
                  {s.remaining > 0 && !plan.cancelled && (
                    <Button className="flex-1" onClick={() => quick.open("payment", { plan })}>
                      <HandCoins /> Tahsilat al
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => quick.open("plan", { record: plan })}>
                    <Pencil /> Düzenle
                  </Button>
                </div>
              )}
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taksitler
              </p>
              <ol className="stagger space-y-2">
                {plan.installments.map((inst, i) => {
                  const st = installmentStatus(inst);
                  const rem = installmentRemaining(inst);
                  return (
                    <li
                      key={inst.id}
                      className={cn(
                        "rounded-xl border border-border/80 p-3",
                        st === "Gecikmiş" &&
                          "border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                            st === "Ödendi"
                              ? "bg-emerald-500 text-white"
                              : st === "Gecikmiş"
                                ? "bg-rose-500 text-white"
                                : "bg-secondary",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{formatDate(inst.dueDate)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {st === "Ödendi" ? "Ödendi" : relativeDue(inst.dueDate)}
                            {installmentPaid(inst) > 0 &&
                              st !== "Ödendi" &&
                              ` · ${installmentPaid(inst).toLocaleString("tr-TR")} ₺ ödendi`}
                          </p>
                        </div>
                        <div className="text-right">
                          <Money value={inst.amount} className="text-sm font-semibold" />
                          {rem > 0 && rem < inst.amount && (
                            <p className="text-[11px] text-muted-foreground">
                              kalan {rem.toLocaleString("tr-TR")} ₺
                            </p>
                          )}
                        </div>
                        {permissions.manageFinance && rem > 0 && !plan.cancelled && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => quick.open("payment", { plan, installmentId: inst.id })}
                          >
                            Tahsil et
                          </Button>
                        )}
                      </div>
                      {inst.payments.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                          {inst.payments.map((p) => (
                            <li
                              key={p.id}
                              className="group flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span className="flex-1">
                                {formatDate(p.date)} · {p.method}
                                {account(p.accountId) && ` · ${account(p.accountId)}`}
                              </span>
                              <Money value={p.amount} className="font-medium text-foreground" />
                              {permissions.manageFinance && (
                                <button
                                  type="button"
                                  title="Ödemeyi geri al"
                                  className="rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                  onClick={async () => {
                                    if (
                                      await confirm({
                                        title: "Ödeme geri alınsın mı?",
                                        description:
                                          "Tahsilat kaydı silinir, taksit tekrar açık olur.",
                                        confirmLabel: "Geri al",
                                      })
                                    ) {
                                      removeInstallmentPayment(plan.id, p.id);
                                      toast.success("Ödeme geri alındı");
                                    }
                                  }}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
              {plan.note && (
                <p className="mt-4 rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
                  {plan.note}
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
