import { useMemo } from "react";
import { useErp } from "@/lib/erp-store";
import type { Option } from "@/components/app/fields";
import { formatMoney } from "@/lib/format";
import { accountBalances } from "@/lib/finance";

/** Formlarda kullanılan seçenek listeleri. */
export function useOptions() {
  const { state, staff, lawyers } = useErp();
  return useMemo(() => {
    const clientName = (id?: string) => state.clients.find((c) => c.id === id)?.name;
    const clients: Option[] = state.clients
      .filter((c) => c.status === "Aktif")
      .map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.kind === "Kurumsal" ? "Kurumsal" : undefined,
      }));
    const allClients: Option[] = state.clients.map((c) => ({ value: c.id, label: c.name }));
    const cases: Option[] = state.cases.map((c) => ({
      value: c.id,
      label: `${c.no} · ${c.title}`,
      hint: clientName(c.clientId),
    }));
    const casesOf = (clientId?: string) =>
      clientId
        ? cases.filter((o) => state.cases.find((c) => c.id === o.value)?.clientId === clientId)
        : cases;
    const balances = new Map(accountBalances(state).map((b) => [b.account.id, b.balance]));
    const accounts: Option[] = state.accounts
      .filter((a) => a.active)
      .map((a) => ({ value: a.id, label: a.name, hint: formatMoney(balances.get(a.id) ?? 0) }));
    const staffOpts: Option[] = staff.map((u) => ({ value: u.id, label: u.name, hint: u.role }));
    const lawyerOpts: Option[] = lawyers.map((u) => ({ value: u.id, label: u.name }));
    const debtors: Option[] = state.debtors.map((d) => ({ value: d.id, label: d.name }));
    const enforcements: Option[] = state.enforcements.map((e) => ({
      value: e.id,
      label: e.no,
      hint: clientName(e.clientId),
    }));
    return {
      clients,
      allClients,
      cases,
      casesOf,
      accounts,
      staff: staffOpts,
      lawyers: lawyerOpts,
      debtors,
      enforcements,
      caseTypes: state.settings.caseTypes,
      expenseTypes: state.settings.expenseTypes,
      reminderTypes: state.settings.reminderTypes,
      documentCategories: state.settings.documentCategories,
    };
  }, [state, staff, lawyers]);
}
