import { Plus, Trash2, Info, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  FormDialog,
  type FormErrors,
  type FormField,
  type FormValues,
} from "@/components/app/FormDialog";
import { Combobox, MoneyInput } from "@/components/app/fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttachmentList } from "@/components/app/files";
import { Money } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useErp, uid } from "@/lib/erp-store";
import { useOptions } from "@/lib/options";
import {
  FEE_KINDS,
  PAYMENT_METHODS,
  type Account,
  type AccountTx,
  type Advance,
  type Expense,
  type FeePlan,
  type Installment,
} from "@/lib/erp-types";
import {
  addDays,
  addMonths,
  formatDate,
  formatMoney,
  round2,
  splitAmount,
  sum,
  today,
} from "@/lib/format";
import { advanceBalance, caseClientId, installmentPaid, installmentRemaining } from "@/lib/finance";
import { cn } from "@/lib/utils";
import type { FormProps } from "@/components/forms/core";

/* ───────────── Masraf ───────────── */

export function ExpenseForm({ open, onOpenChange, record, preset, onSaved }: FormProps<Expense>) {
  const { save, state, currentUser, permissions } = useErp();
  const o = useOptions();
  const accounts = permissions.viewFinance
    ? o.accounts
    : o.accounts.map((a) => ({ ...a, hint: undefined }));
  const forClient = (v: FormValues) => v.chargeTo === "Müvekkil";
  const fields: FormField[] = [
    {
      name: "chargeTo",
      label: "Masraf kime ait?",
      type: "segmented",
      options: [
        { value: "Müvekkil", label: "Müvekkil / dosya masrafı" },
        { value: "Büro", label: "Büro gideri" },
      ],
    },
    {
      name: "caseId",
      label: "Dosya",
      type: "combobox",
      options: o.cases,
      allowClear: true,
      visible: forClient,
      placeholder: "Dosya seçin",
      onChange: (val) => (val ? { clientId: caseClientId(state, String(val)) } : {}),
    },
    {
      name: "clientId",
      label: "Müvekkil",
      type: "combobox",
      options: o.allClients,
      required: true,
      visible: forClient,
      onChange: (val, v) =>
        v.caseId && caseClientId(state, v.caseId) !== val ? { caseId: "" } : {},
    },
    { name: "type", label: "Masraf türü", type: "select", options: o.expenseTypes, required: true },
    { name: "title", label: "Açıklama", required: true, placeholder: "Örn. Bilirkişi ücreti" },
    { name: "amount", label: "Tutar", type: "money", required: true },
    { name: "date", label: "Tarih", type: "date", required: true },
    {
      name: "paidBy",
      label: "Ödemeyi kim yaptı?",
      type: "segmented",
      visible: forClient,
      options: [
        { value: "Büro", label: "Büro ödedi (avanstan düşer)" },
        { value: "Müvekkil", label: "Müvekkil kendisi ödedi" },
      ],
    },
    {
      name: "accountId",
      label: "Ödendiği hesap",
      type: "combobox",
      options: accounts,
      visible: (v) => v.chargeTo === "Büro" || v.paidBy === "Büro",
      placeholder: "Kasa / banka",
      allowClear: true,
    },
    { name: "note", label: "Not", type: "textarea" },
  ];
  const initial: FormValues = {
    chargeTo: "Müvekkil",
    paidBy: "Büro",
    type: o.expenseTypes[0],
    date: today(),
    receipts: [],
    accountId: state.accounts.find((a) => a.type === "Kasa")?.id,
    ...preset,
    ...record,
  };
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Masrafı düzenle" : "Yeni masraf"}
      description="Makbuz ekleyebilir, avans bakiyesine etkisini anında görebilirsiniz."
      fields={fields}
      initial={initial}
      wide
      onSubmit={(v) => {
        const isClient = v.chargeTo === "Müvekkil";
        const paidBy = isClient ? v.paidBy : "Büro";
        const item = save("expenses", {
          id: record?.id,
          title: v.title.trim(),
          type: v.type,
          amount: Number(v.amount),
          date: v.date,
          chargeTo: v.chargeTo,
          paidBy,
          caseId: isClient ? v.caseId || undefined : undefined,
          clientId: isClient ? v.clientId || undefined : undefined,
          accountId: paidBy === "Büro" ? v.accountId || undefined : undefined,
          receipts: v.receipts ?? [],
          note: v.note || undefined,
          createdBy: record?.createdBy ?? currentUser.id,
        });
        toast.success(record ? "Masraf güncellendi" : "Masraf kaydedildi");
        onSaved?.(item);
      }}
    >
      {(v, set) => {
        const clientId = v.chargeTo === "Müvekkil" ? v.clientId : undefined;
        const bal = clientId ? advanceBalance(state, clientId) : null;
        const effect =
          bal && v.paidBy === "Büro"
            ? round2(
                bal.balance +
                  (record &&
                  record.clientId === clientId &&
                  record.paidBy === "Büro" &&
                  record.chargeTo === "Müvekkil"
                    ? record.amount
                    : 0) -
                  (Number(v.amount) || 0),
              )
            : null;
        return (
          <div className="space-y-4">
            {bal && permissions.viewFinance && (
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-secondary/40 px-4 py-3 text-sm animate-fade-up">
                <Wallet className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">Avans bakiyesi</span>
                <Money value={bal.balance} className="font-semibold" />
                {effect != null && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <Money value={effect} colored className="font-semibold" />
                  </>
                )}
              </div>
            )}
            <div>
              <p className="mb-2 text-[13px] font-medium">Makbuz / belge</p>
              <AttachmentList
                files={v.receipts ?? []}
                onChange={(files) => set({ receipts: files })}
              />
            </div>
          </div>
        );
      }}
    </FormDialog>
  );
}

/* ───────────── Masraf avansı ───────────── */

export function AdvanceForm({ open, onOpenChange, record, preset, onSaved }: FormProps<Advance>) {
  const { save, state } = useErp();
  const o = useOptions();
  const fields: FormField[] = [
    {
      name: "kind",
      label: "İşlem",
      type: "segmented",
      options: [
        { value: "Avans", label: "Avans alındı" },
        { value: "İade", label: "Avans iadesi" },
      ],
    },
    {
      name: "clientId",
      label: "Müvekkil",
      type: "combobox",
      options: o.allClients,
      required: true,
      onChange: () => ({ caseId: "" }),
    },
    { name: "amount", label: "Tutar", type: "money", required: true, autoFocus: true },
    { name: "date", label: "Tarih", type: "date", required: true },
    { name: "method", label: "Ödeme yöntemi", type: "select", options: [...PAYMENT_METHODS] },
    { name: "accountId", label: "Hesap", type: "combobox", options: o.accounts, required: true },
    { name: "note", label: "Açıklama", type: "textarea" },
  ];
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Avans kaydını düzenle" : "Masraf avansı"}
      description="Müvekkilden masraflar için alınan para. Masraflar bu bakiyeden düşer."
      fields={fields}
      initial={{
        kind: "Avans",
        date: today(),
        method: "Havale/EFT",
        accountId: state.accounts.find((a) => a.type === "Banka")?.id,
        ...preset,
        ...record,
      }}
      onSubmit={(v) => {
        const item = save("advances", {
          id: record?.id,
          kind: v.kind,
          clientId: v.clientId,
          caseId: v.caseId || undefined,
          amount: Number(v.amount),
          date: v.date,
          method: v.method,
          accountId: v.accountId || undefined,
          note: v.note || undefined,
        });
        toast.success(v.kind === "Avans" ? "Avans kaydedildi" : "İade kaydedildi");
        onSaved?.(item);
      }}
    >
      {(v, set) => {
        const caseOpts = o.casesOf(v.clientId);
        const bal = v.clientId ? advanceBalance(state, v.clientId) : null;
        return (
          <div className="space-y-4">
            {v.clientId && caseOpts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="mr-1 self-center text-xs text-muted-foreground">Dosya:</span>
                {[{ value: "", label: "Genel" }, ...caseOpts].map((c) => (
                  <button
                    key={c.value || "none"}
                    type="button"
                    onClick={() => set({ caseId: c.value })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      (v.caseId ?? "") === c.value
                        ? "border-primary bg-primary text-primary-foreground shadow-soft"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {bal && (
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-secondary/40 px-4 py-3 text-sm">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Mevcut avans bakiyesi</span>
                <Money value={bal.balance} colored className="font-semibold" />
              </div>
            )}
          </div>
        );
      }}
    </FormDialog>
  );
}

/* ───────────── Tahsilat planı (taksit sihirbazı) ───────────── */

type Row = { id?: string; dueDate: string; amount: number; payments?: Installment["payments"] };

const PERIODS = ["Aylık", "2 haftada bir", "Haftalık", "3 ayda bir"] as const;

function stepDate(start: string, period: string, i: number) {
  if (period === "Haftalık") return addDays(start, 7 * i);
  if (period === "2 haftada bir") return addDays(start, 14 * i);
  if (period === "3 ayda bir") return addMonths(start, 3 * i);
  return addMonths(start, i);
}

function regen(v: FormValues, prev: Row[]): Row[] {
  const total = Number(v.total) || 0;
  let rows: Row[];
  if (v.mode === "single") {
    rows = [{ dueDate: v.firstDue || v.date, amount: total }];
  } else {
    const down = Math.min(Number(v.downPayment) || 0, total);
    const count = Math.max(1, Math.min(Number(v.count) || 1, 60));
    const rest = round2(total - down);
    rows = [];
    if (down > 0) rows.push({ dueDate: v.date, amount: down });
    splitAmount(rest, count).forEach((amount, i) =>
      rows.push({ dueDate: stepDate(v.firstDue || v.date, v.period, i), amount }),
    );
  }
  // Mevcut ödemeleri sıraya göre koru
  return rows.map((r, i) => ({ ...r, id: prev[i]?.id, payments: prev[i]?.payments ?? [] }));
}

export function PlanForm({ open, onOpenChange, record, preset, onSaved }: FormProps<FeePlan>) {
  const { save, state } = useErp();
  const o = useOptions();
  const editing = !!record;
  const regenOn = (name: string) => (val: unknown, v: FormValues) => ({
    rows: regen({ ...v, [name]: val }, v.rows ?? []),
  });

  const fields: FormField[] = [
    {
      name: "clientId",
      label: "Müvekkil",
      type: "combobox",
      options: o.allClients,
      required: true,
      onChange: () => ({ caseId: "" }),
    },
    {
      name: "caseId",
      label: "Dosya",
      type: "combobox",
      options: o.cases,
      allowClear: true,
      placeholder: "Dosyasız",
    },
    {
      name: "kind",
      label: "Ücret türü",
      type: "select",
      options: [...FEE_KINDS],
      onChange: (val, v) => (!v.titleTouched ? { title: String(val) } : {}),
    },
    { name: "title", label: "Açıklama", required: true, onChange: () => ({ titleTouched: true }) },
    {
      name: "total",
      label: "Toplam tutar",
      type: "money",
      required: true,
      onChange: regenOn("total"),
    },
    {
      name: "date",
      label: "Anlaşma tarihi",
      type: "date",
      required: true,
      onChange: regenOn("date"),
    },
    {
      name: "mode",
      label: "Ödeme şekli",
      type: "segmented",
      section: "Ödeme planı",
      options: [
        { value: "single", label: "Tek seferde" },
        { value: "installment", label: "Taksitli" },
      ],
      onChange: regenOn("mode"),
    },
    {
      name: "downPayment",
      label: "Peşinat",
      type: "money",
      visible: (v) => v.mode === "installment",
      onChange: regenOn("downPayment"),
    },
    {
      name: "count",
      label: "Taksit sayısı",
      type: "number",
      visible: (v) => v.mode === "installment",
      onChange: regenOn("count"),
    },
    { name: "firstDue", label: "İlk vade", type: "date", onChange: regenOn("firstDue") },
    {
      name: "period",
      label: "Sıklık",
      type: "select",
      options: [...PERIODS],
      visible: (v) => v.mode === "installment",
      onChange: regenOn("period"),
    },
    { name: "note", label: "Not", type: "textarea" },
  ];

  const initialRows: Row[] = record?.installments.map((i) => ({ ...i })) ?? [];
  const base: FormValues = {
    kind: "Vekalet ücreti",
    title: "Vekalet ücreti",
    date: today(),
    firstDue: addMonths(today(), 1),
    mode: "installment",
    count: 3,
    period: "Aylık",
    downPayment: 0,
    payNow: false,
    method: "Havale/EFT",
    accountId: state.accounts.find((a) => a.type === "Banka")?.id,
    ...preset,
  };
  const initial: FormValues = record
    ? {
        ...base,
        ...record,
        titleTouched: true,
        mode: record.installments.length > 1 ? "installment" : "single",
        count: record.installments.length,
        firstDue: record.installments[0]?.dueDate,
        rows: initialRows,
      }
    : { ...base, rows: regen(base, []) };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Tahsilat planını düzenle" : "Yeni tahsilat planı"}
      description="Ücreti tek seferde ya da taksitle planlayın; tablo üzerinden vade ve tutarları değiştirebilirsiniz."
      fields={fields}
      initial={initial}
      wide
      validate={(v): FormErrors | undefined => {
        const rows: Row[] = v.rows ?? [];
        const total = round2(Number(v.total) || 0);
        const rowSum = sum(rows.map((r) => r.amount));
        if (!rows.length) return { _form: "En az bir taksit olmalı" };
        if (Math.abs(rowSum - total) > 0.009)
          return {
            _form: `Taksitlerin toplamı (${formatMoney(rowSum)}) toplam tutarla (${formatMoney(total)}) eşleşmiyor.`,
          };
        if (rows.some((r) => !r.dueDate || r.amount <= 0))
          return { _form: "Her taksitin tarihi ve tutarı olmalı" };
        const lost = (record?.installments ?? []).slice(rows.length).some((i) => i.payments.length);
        if (lost) return { _form: "Ödemesi alınmış taksitler silinemez. Önce ödemeyi geri alın." };
        if (rows.some((r) => sum((r.payments ?? []).map((p) => p.amount)) > r.amount + 0.009))
          return { _form: "Bir taksitin tutarı, o taksite alınan ödemenin altına düşemez." };
        if (v.payNow && !v.accountId) return { accountId: "Hesap seçin" };
        return undefined;
      }}
      onSubmit={(v) => {
        const rows: Row[] = v.rows;
        let installments: Installment[] = rows.map((r) => ({
          id: r.id ?? uid("inst"),
          dueDate: r.dueDate,
          amount: round2(r.amount),
          payments: r.payments ?? [],
        }));
        if (!editing && v.payNow && installments[0]) {
          installments = installments.map((inst, i) =>
            i === 0
              ? {
                  ...inst,
                  payments: [
                    {
                      id: uid("ip"),
                      date: v.date,
                      amount: inst.amount,
                      method: v.method,
                      accountId: v.accountId,
                    },
                  ],
                }
              : inst,
          );
        }
        const item = save("plans", {
          id: record?.id,
          title: v.title.trim(),
          kind: v.kind,
          clientId: v.clientId,
          caseId: v.caseId || undefined,
          date: v.date,
          total: round2(Number(v.total)),
          installments,
          period: record?.period,
          cancelled: record?.cancelled ?? false,
          note: v.note || undefined,
        });
        toast.success(editing ? "Plan güncellendi" : "Tahsilat planı oluşturuldu");
        onSaved?.(item);
      }}
    >
      {(v, set) => {
        const rows: Row[] = v.rows ?? [];
        const total = round2(Number(v.total) || 0);
        const rowSum = sum(rows.map((r) => r.amount));
        const diff = round2(total - rowSum);
        const update = (i: number, patch: Partial<Row>) =>
          set({ rows: rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
        return (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border/80">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
                <p className="text-[13px] font-semibold">Taksit tablosu</p>
                <p
                  className={cn(
                    "text-xs font-medium",
                    Math.abs(diff) > 0.009 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  Toplam <Money value={rowSum} className="font-semibold text-foreground" />
                  {Math.abs(diff) > 0.009 && <> · fark {formatMoney(diff)}</>}
                </p>
              </div>
              <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                {rows.map((r, i) => {
                  const paid = sum((r.payments ?? []).map((p) => p.amount));
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 px-3 py-2 animate-fade-up sm:grid-cols-[2.5rem_1fr_1fr_auto_2rem]"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {i + 1}
                      </span>
                      <Input
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => update(i, { dueDate: e.target.value })}
                        className="h-9"
                      />
                      <MoneyInput value={r.amount} onChange={(n) => update(i, { amount: n })} />
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        {paid > 0 && (
                          <span className="text-emerald-600">Ödenen {formatMoney(paid)}</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={rows.length <= 1 || paid > 0}
                        onClick={() => set({ rows: rows.filter((_, idx) => idx !== i) })}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Taksiti sil"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set({
                      rows: [
                        ...rows,
                        {
                          dueDate: stepDate(rows[rows.length - 1]?.dueDate ?? today(), "Aylık", 1),
                          amount: diff > 0 ? diff : 0,
                          payments: [],
                        },
                      ],
                    })
                  }
                >
                  <Plus /> Taksit ekle
                </Button>
                {Math.abs(diff) > 0.009 && rows.length > 0 && (
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() =>
                      update(rows.length - 1, {
                        amount: round2(rows[rows.length - 1].amount + diff),
                      })
                    }
                  >
                    Farkı son taksite ekle
                  </Button>
                )}
              </div>
            </div>
            {!editing && (
              <div className="space-y-3 rounded-xl border border-border/80 bg-secondary/30 p-4">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={!!v.payNow}
                    onChange={(e) => set({ payNow: e.target.checked })}
                  />
                  {v.mode === "single" ? "Ödeme şimdi alındı" : "İlk taksit / peşinat şimdi alındı"}
                </label>
                {v.payNow && (
                  <div className="grid gap-3 animate-fade-up sm:grid-cols-2">
                    <Select value={v.method} onValueChange={(m) => set({ method: m })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Combobox
                      value={v.accountId}
                      onChange={(a) => set({ accountId: a })}
                      options={o.accounts}
                      placeholder="Hesap seçin"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      }}
    </FormDialog>
  );
}

/* ───────────── Tahsilat al ───────────── */

export function PaymentForm({
  open,
  onOpenChange,
  plan,
  installmentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan?: FeePlan;
  installmentId?: string;
}) {
  const { recordInstallmentPayment, state } = useErp();
  const o = useOptions();
  if (!plan) return null;
  const inst =
    plan.installments.find((i) => i.id === installmentId) ??
    plan.installments.find((i) => installmentRemaining(i) > 0) ??
    plan.installments[0];
  const idx = plan.installments.indexOf(inst);
  const remaining = installmentRemaining(inst);
  const planRemaining = sum(plan.installments.map(installmentRemaining));
  const client = state.clients.find((c) => c.id === plan.clientId);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tahsilat al"
      description={`${client?.name ?? ""} · ${plan.title}`}
      submitLabel="Tahsil et"
      fields={[
        { name: "amount", label: "Tutar", type: "money", required: true, autoFocus: true },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "method", label: "Ödeme yöntemi", type: "select", options: [...PAYMENT_METHODS] },
        {
          name: "accountId",
          label: "Yatırılan hesap",
          type: "combobox",
          options: o.accounts,
          required: true,
        },
        { name: "note", label: "Not", type: "textarea" },
      ]}
      initial={{
        amount: remaining || planRemaining,
        date: today(),
        method: "Havale/EFT",
        accountId: state.accounts.find((a) => a.type === "Banka")?.id,
      }}
      onSubmit={(v) => {
        recordInstallmentPayment(plan.id, inst.id, {
          amount: Number(v.amount),
          date: v.date,
          method: v.method,
          accountId: v.accountId,
          note: v.note || undefined,
        });
        toast.success(`${formatMoney(Number(v.amount))} tahsil edildi`);
      }}
    >
      {(v) => (
        <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/30 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {idx + 1}. taksit · vade {formatDate(inst.dueDate)}
            </span>
            <span>
              Kalan <Money value={remaining} className="font-semibold" />
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan toplam kalan</span>
            <Money value={planRemaining} className="font-semibold" />
          </div>
          {Number(v.amount) > remaining + 0.009 && (
            <p className="flex items-center gap-2 pt-1 text-xs text-primary animate-fade-up">
              <Info className="h-3.5 w-3.5" /> Fazla tutar sıradaki taksitlere otomatik aktarılır.
            </p>
          )}
          {installmentPaid(inst) > 0 && (
            <p className="text-xs text-muted-foreground">
              Bu taksite daha önce {formatMoney(installmentPaid(inst))} ödendi.
            </p>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ───────────── Banka / Kasa ───────────── */

export function AccountForm({ open, onOpenChange, record, onSaved }: FormProps<Account>) {
  const { save } = useErp();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Hesabı düzenle" : "Yeni hesap"}
      fields={[
        { name: "type", label: "Hesap türü", type: "segmented", options: ["Kasa", "Banka"] },
        {
          name: "name",
          label: "Hesap adı",
          required: true,
          span: 2,
          placeholder: "Örn. İş Bankası Ticari",
        },
        { name: "bankName", label: "Banka", visible: (v) => v.type === "Banka" },
        { name: "iban", label: "IBAN", visible: (v) => v.type === "Banka", placeholder: "TR.." },
        { name: "openingBalance", label: "Açılış bakiyesi", type: "money" },
        { name: "openingDate", label: "Açılış tarihi", type: "date", required: true },
        { name: "active", label: "Hesap aktif", type: "switch" },
      ]}
      initial={{ type: "Banka", openingDate: today(), active: true, openingBalance: 0, ...record }}
      onSubmit={(v) => {
        const item = save("accounts", {
          id: record?.id,
          name: v.name.trim(),
          type: v.type,
          bankName: v.type === "Banka" ? v.bankName || undefined : undefined,
          iban:
            v.type === "Banka"
              ? (v.iban || "").replace(/\s+/g, "").toUpperCase() || undefined
              : undefined,
          openingBalance: Number(v.openingBalance) || 0,
          openingDate: v.openingDate,
          active: !!v.active,
        });
        toast.success(record ? "Hesap güncellendi" : "Hesap eklendi");
        onSaved?.(item);
      }}
    />
  );
}

export function TransferForm({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { fromId?: string };
}) {
  const { createTransfer } = useErp();
  const o = useOptions();
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Virman"
      description="Hesaplar arası para transferi"
      submitLabel="Transfer et"
      fields={[
        {
          name: "fromId",
          label: "Çıkış hesabı",
          type: "combobox",
          options: o.accounts,
          required: true,
        },
        {
          name: "toId",
          label: "Giriş hesabı",
          type: "combobox",
          options: o.accounts,
          required: true,
        },
        { name: "amount", label: "Tutar", type: "money", required: true },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "description", label: "Açıklama", span: 2 },
      ]}
      initial={{ date: today(), ...preset }}
      validate={(v) =>
        v.fromId && v.fromId === v.toId ? { toId: "Farklı bir hesap seçin" } : undefined
      }
      onSubmit={(v) => {
        createTransfer({
          fromId: v.fromId,
          toId: v.toId,
          amount: Number(v.amount),
          date: v.date,
          description: v.description ?? "",
        });
        toast.success("Virman yapıldı");
      }}
    />
  );
}

export function TxForm({ open, onOpenChange, record, preset }: FormProps<AccountTx>) {
  const { save } = useErp();
  const o = useOptions();
  const isOut = (cat: string) => cat !== "Diğer gelir";
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? "Hareketi düzenle" : "Hesap hareketi"}
      fields={[
        {
          name: "category",
          label: "Hareket türü",
          type: "segmented",
          options: [
            { value: "Diğer gelir", label: "Gelir" },
            { value: "Diğer gider", label: "Gider" },
            { value: "Müvekkile aktarım", label: "Müvekkile ödeme" },
          ],
        },
        {
          name: "accountId",
          label: "Hesap",
          type: "combobox",
          options: o.accounts,
          required: true,
        },
        {
          name: "clientId",
          label: "Müvekkil",
          type: "combobox",
          options: o.allClients,
          required: true,
          visible: (v) => v.category === "Müvekkile aktarım",
        },
        { name: "amount", label: "Tutar", type: "money", required: true },
        { name: "date", label: "Tarih", type: "date", required: true },
        { name: "description", label: "Açıklama", required: true, span: 2 },
      ]}
      initial={{
        category: "Diğer gider",
        date: today(),
        ...preset,
        ...record,
        amount: record ? Math.abs(record.amount) : preset?.amount,
      }}
      onSubmit={(v) => {
        const amount = Math.abs(Number(v.amount));
        save("transactions", {
          id: record?.id,
          accountId: v.accountId,
          category: v.category,
          amount: isOut(v.category) ? -amount : amount,
          date: v.date,
          description: v.description.trim(),
          clientId: v.category === "Müvekkile aktarım" ? v.clientId : undefined,
        });
        toast.success("Hareket kaydedildi");
      }}
    />
  );
}
