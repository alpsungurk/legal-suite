import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { ManagementPage } from "@/components/management/ManagementPage";
import { useErp } from "@/lib/erp-store";
import type { Expense, Payment } from "@/lib/erp-types";

export const Route = createFileRoute("/cari-hesap")({ component: Page });

function paidPaymentAmount(payment: Payment) {
  if (payment.status === "İptal") return 0;
  if (payment.installments?.length) {
    return payment.installments
      .filter((installment) => installment.status === "Ödendi")
      .reduce((sum, installment) => sum + installment.amount, 0);
  }
  return payment.status === "Tamamlandı" ? payment.amount : 0;
}

function expenseReceivable(expense: Expense) {
  return (expense.direction ?? "Giden") === "Giden" &&
    expense.payer !== "Müvekkil" &&
    expense.payer !== "Karşı taraf"
    ? expense.amount
    : 0;
}

function expenseRecovery(expense: Expense) {
  const isIncoming =
    expense.direction === "Gelen" || (!expense.direction && expense.payer === "Müvekkil");
  return isIncoming && expense.status === "Alındı" ? expense.amount : 0;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthKey(date: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

function monthCountInclusive(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return Math.max((toYear - fromYear) * 12 + toMonth - fromMonth + 1, 0);
}

function Page() {
  const { state, formatMoney, permissions } = useErp();

  if (!permissions.canViewFinance) {
    return (
      <div className="rounded-xl border p-8 text-center text-muted-foreground">
        Bu sayfaya erişim yetkiniz yok.
      </div>
    );
  }

  const currentMonth = currentMonthKey();
  const rows = state.clients.map((client) => {
    const clientCases = state.cases.filter((c) => c.clientId === client.id);
    const caseIds = new Set(clientCases.map((c) => c.id));
    const clientExpenses = state.expenses.filter((expense) =>
      expense.caseId ? caseIds.has(expense.caseId) : expense.clientId === client.id,
    );
    const clientPayments = state.payments.filter((p) =>
      p.caseId ? caseIds.has(p.caseId) : p.clientId === client.id,
    );
    const borc = clientExpenses.reduce((sum, expense) => sum + expenseReceivable(expense), 0);
    const odenen = clientExpenses.reduce((sum, expense) => sum + expenseRecovery(expense), 0);
    const kalan = borc - odenen;
    const vekaletUcreti = clientPayments.reduce(
      (sum, payment) => sum + paidPaymentAmount(payment),
      0,
    );
    const monthlyFeeStart = client.monthlyFeeStartDate ? monthKey(client.monthlyFeeStartDate) : "";
    const monthlyPeriods =
      client.kind === "Kurumsal" &&
      client.monthlyFee &&
      monthlyFeeStart &&
      monthlyFeeStart <= currentMonth
        ? monthCountInclusive(monthlyFeeStart, currentMonth)
        : 0;
    const monthlyFeeDue = monthlyPeriods * (client.monthlyFee ?? 0);
    const monthlyFeeReceived = clientPayments
      .filter(
        (payment) =>
          payment.feePeriod &&
          payment.feePeriod >= monthlyFeeStart &&
          payment.feePeriod <= currentMonth,
      )
      .reduce((sum, payment) => sum + paidPaymentAmount(payment), 0);
    const monthlyFeeRemaining = Math.max(monthlyFeeDue - monthlyFeeReceived, 0);
    return {
      id: client.id,
      client: client.name,
      kind: client.kind,
      monthlyFee: client.monthlyFee ? formatMoney(client.monthlyFee) : "—",
      borc: formatMoney(borc),
      odenen: formatMoney(odenen),
      kalan: formatMoney(kalan),
      vekaletUcreti: formatMoney(vekaletUcreti),
      monthlyFeeDue: formatMoney(monthlyFeeDue),
      monthlyFeeReceived: formatMoney(monthlyFeeReceived),
      monthlyFeeRemaining: formatMoney(monthlyFeeRemaining),
      hareketler: [
        ...clientExpenses.map(
          (expense) =>
            `${expense.date} • ${expenseRecovery(expense) ? "Masraf tahsilatı" : "Müvekkil masrafı"} • ${expense.title} • ${formatMoney(expense.amount)}`,
        ),
        ...clientPayments.map((payment) => {
          const period = payment.feePeriod ? ` • Aylık dönem ${payment.feePeriod}` : "";
          return `${payment.date} • Vekalet ücreti tahsilatı${period} (cari masraf bakiyesinden ayrı) • ${formatMoney(paidPaymentAmount(payment))}`;
        }),
      ]
        .sort()
        .reverse()
        .join("\n"),
      status: kalan + monthlyFeeRemaining > 0 ? "Borçlu" : kalan < 0 ? "Alacaklı" : "Güncel",
    };
  });

  const totalBorc = state.expenses.reduce((sum, expense) => sum + expenseReceivable(expense), 0);
  const totalPay = state.expenses.reduce((sum, expense) => sum + expenseRecovery(expense), 0);
  const totalVekalet = state.payments.reduce((sum, payment) => sum + paidPaymentAmount(payment), 0);
  const totalBalance = totalBorc - totalPay;
  return (
    <ManagementPage
      title="Cari Hesap"
      description="Müvekkil masrafı ve masraf tahsilatını cari hesapta; vekalet ücretini ayrı izleyin."
      singular="cari hesap kaydı"
      icon={Landmark}
      accent="green"
      readOnly
      canCreate={false}
      columns={[
        { key: "client", label: "Müvekkil" },
        { key: "kind", label: "Tür", filterable: true },
        { key: "monthlyFee", label: "Aylık ücret" },
        { key: "monthlyFeeDue", label: "Aylık biriken" },
        { key: "monthlyFeeReceived", label: "Aylık alınan" },
        { key: "monthlyFeeRemaining", label: "Aylık kalan" },
        { key: "borc", label: "Borç" },
        { key: "odenen", label: "Ödenen" },
        { key: "kalan", label: "Kalan" },
        { key: "vekaletUcreti", label: "Vekalet ücreti" },
        {
          key: "status",
          label: "Durum",
          filterable: true,
          filterOptions: ["Güncel", "Borçlu", "Alacaklı"],
        },
      ]}
      stats={[
        { label: "Müvekkil masrafı", value: formatMoney(totalBorc), note: "Müvekkile yansıtılan" },
        {
          label: "Masraf tahsilatı",
          value: formatMoney(totalPay),
          note: "Gelen masraf hareketleri",
        },
        {
          label: "Cari açık",
          value: formatMoney(Math.max(totalBalance, 0)),
          note: "Masraf eksi masraf tahsilatı",
        },
        { label: "Vekalet ücreti", value: formatMoney(totalVekalet), note: "Ayrı tahsilat kalemi" },
      ]}
      rows={rows}
    />
  );
}
