/**
 * Formları uygulamanın her yerinden açmak için tek bir sağlayıcı:
 *   const quick = useQuick();  quick.open("expense", { preset: { caseId } });
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CaseForm, ClientForm, UserForm } from "@/components/forms/core";
import {
  AccountForm,
  AdvanceForm,
  ExpenseForm,
  PaymentForm,
  PlanForm,
  TransferForm,
  TxForm,
} from "@/components/forms/finance";
import {
  CollectionForm,
  ContactForm,
  DebtorForm,
  DocRequestForm,
  DocumentForm,
  EnforcementForm,
  PromiseForm,
  ReminderForm,
} from "@/components/forms/other";
import type {
  Account,
  AccountTx,
  Advance,
  CaseFile,
  Client,
  Collection,
  ContactLog,
  Debtor,
  DocumentFile,
  DocumentRequest,
  EnforcementFile,
  Expense,
  FeePlan,
  PaymentPromise,
  Reminder,
  User,
} from "@/lib/erp-types";

type Spec<T> = {
  record?: T;
  preset?: Partial<T> & Record<string, unknown>;
  onSaved?: (item: T) => void;
};

type Kinds = {
  client: Spec<Client>;
  case: Spec<CaseFile>;
  user: Spec<User>;
  expense: Spec<Expense>;
  advance: Spec<Advance>;
  plan: Spec<FeePlan>;
  payment: { plan: FeePlan; installmentId?: string };
  account: Spec<Account>;
  transfer: { preset?: { fromId?: string } };
  tx: Spec<AccountTx>;
  reminder: Spec<Reminder>;
  debtor: Spec<Debtor>;
  enforcement: Spec<EnforcementFile>;
  promise: Spec<PaymentPromise>;
  collection: Spec<Collection>;
  contact: Spec<ContactLog>;
  document: Spec<DocumentFile> & { preset?: Partial<DocumentFile> & { requestId?: string } };
  docRequest: Spec<DocumentRequest>;
};

export type QuickKind = keyof Kinds;

type Active = { [K in QuickKind]: { kind: K; props: Kinds[K] } }[QuickKind];

type QuickCtx = {
  open: <K extends QuickKind>(kind: K, props?: Kinds[K]) => void;
};

const Ctx = createContext<QuickCtx>({ open: () => {} });

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const [visible, setVisible] = useState(false);
  const [seq, setSeq] = useState(0);

  const open = useCallback(<K extends QuickKind>(kind: K, props?: Kinds[K]) => {
    setActive({ kind, props: (props ?? {}) as Kinds[K] } as Active);
    setSeq((n) => n + 1);
    setVisible(true);
  }, []);

  const common = { open: visible, onOpenChange: setVisible };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {active?.kind === "client" && <ClientForm key={seq} {...common} {...active.props} />}
      {active?.kind === "case" && <CaseForm key={seq} {...common} {...active.props} />}
      {active?.kind === "user" && <UserForm key={seq} {...common} {...active.props} />}
      {active?.kind === "expense" && <ExpenseForm key={seq} {...common} {...active.props} />}
      {active?.kind === "advance" && <AdvanceForm key={seq} {...common} {...active.props} />}
      {active?.kind === "plan" && <PlanForm key={seq} {...common} {...active.props} />}
      {active?.kind === "payment" && <PaymentForm key={seq} {...common} {...active.props} />}
      {active?.kind === "account" && <AccountForm key={seq} {...common} {...active.props} />}
      {active?.kind === "transfer" && <TransferForm key={seq} {...common} {...active.props} />}
      {active?.kind === "tx" && <TxForm key={seq} {...common} {...active.props} />}
      {active?.kind === "reminder" && <ReminderForm key={seq} {...common} {...active.props} />}
      {active?.kind === "debtor" && <DebtorForm key={seq} {...common} {...active.props} />}
      {active?.kind === "enforcement" && (
        <EnforcementForm key={seq} {...common} {...active.props} />
      )}
      {active?.kind === "promise" && <PromiseForm key={seq} {...common} {...active.props} />}
      {active?.kind === "collection" && <CollectionForm key={seq} {...common} {...active.props} />}
      {active?.kind === "contact" && <ContactForm key={seq} {...common} {...active.props} />}
      {active?.kind === "document" && <DocumentForm key={seq} {...common} {...active.props} />}
      {active?.kind === "docRequest" && <DocRequestForm key={seq} {...common} {...active.props} />}
    </Ctx.Provider>
  );
}

export function useQuick() {
  return useContext(Ctx);
}
