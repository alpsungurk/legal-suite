import { useMemo, useState } from "react";
import { FilePlus2, Receipt, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ManagementEditorDialog,
  type ManagementFormField,
} from "@/components/management/ManagementEditorDialog";
import {
  buildCaseFormFields,
  buildClientFormFields,
  buildExpenseFormFields,
  buildPaymentFormFields,
} from "@/lib/management-form-config";
import { useErp } from "@/lib/erp-store";

export function WelcomeHeader() {
  const {
    currentUser,
    state,
    clientOptions,
    caseOptions,
    userOptions,
    clientIdByName,
    userIdByName,
    caseIdByLabel,
    upsertClient,
    upsertCase,
    upsertExpense,
    upsertPayment,
    permissions,
  } = useErp();

  const actions = useMemo(
    () =>
      [
        {
          label: "Yeni Müvekkil",
          singular: "müvekkil",
          icon: UserPlus,
          fields: buildClientFormFields(),
          kind: "client" as const,
        },
        {
          label: "Yeni Dosya",
          singular: "dosya",
          icon: FilePlus2,
          fields: buildCaseFormFields({
            clientOptions,
            lawyerOptions: userOptions,
            caseTypes: state.caseTypes,
          }),
          kind: "case" as const,
        },
        {
          label: "Masraf Ekle",
          singular: "masraf",
          icon: Receipt,
          fields: buildExpenseFormFields({
            caseOptions,
            clientOptions,
            expenseTypes: state.expenseTypes,
          }),
          kind: "expense" as const,
        },
        {
          label: "Tahsilat Ekle",
          singular: "tahsilat",
          icon: Wallet,
          fields: buildPaymentFormFields({ clientOptions, caseOptions }),
          kind: "payment" as const,
        },
      ] satisfies Array<{
        label: string;
        singular: string;
        icon: typeof UserPlus;
        fields: ManagementFormField[];
        kind: "client" | "case" | "expense" | "payment";
      }>,
    [clientOptions, caseOptions, userOptions, state.caseTypes, state.expenseTypes],
  );

  const [activeAction, setActiveAction] = useState<(typeof actions)[number] | null>(null);
  const today = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const myReminders = state.reminders.filter(
    (r) => r.assigneeId === currentUser.id && r.status === "Beklemede",
  ).length;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {today}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Hoş Geldiniz, <span className="text-primary">{currentUser.name}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Size atanmış {myReminders} açık hatırlatma var.
          </p>
        </div>
        {permissions.canWrite && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {actions.map((action, index) => (
              <Button
                key={action.label}
                variant={index === 0 ? "default" : "outline"}
                size="sm"
                className="h-9 min-w-0 gap-1.5 rounded-lg px-2.5 font-medium shadow-soft"
                onClick={() => setActiveAction(action)}
              >
                <action.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{action.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
      <ManagementEditorDialog
        open={!!activeAction}
        onOpenChange={(open) => !open && setActiveAction(null)}
        title={activeAction?.label ?? "Yeni kayıt"}
        description="İlgili operasyon sayfasındaki alanlarla aynı bilgileri girin."
        fields={activeAction?.fields ?? buildClientFormFields()}
        formId="dashboard"
        onSave={(data) => {
          if (!activeAction) return;
          if (activeAction.kind === "client") {
            upsertClient({
              name: data.name,
              email: data.email,
              phone: data.phone,
              kind: (data.kind as "Bireysel" | "Kurumsal") || "Bireysel",
              identity: data.identity,
              address: data.address,
              status: data.status === "Pasif" ? "Pasif" : "Aktif",
            });
          } else if (activeAction.kind === "case") {
            const clientId = clientIdByName(data.clientName);
            const responsibleId = userIdByName(data.responsibleName);
            if (!clientId || !responsibleId) {
              toast.error("Müvekkil veya sorumlu seçimi geçersiz");
              return;
            }
            upsertCase({
              no: data.no,
              title: data.title,
              clientId,
              court: data.court,
              type: data.type,
              responsibleId,
              openingDate: data.openingDate,
              stage: data.stage,
              note: data.note,
            });
          } else if (activeAction.kind === "expense") {
            const caseId = caseIdByLabel(data.caseLabel);
            if (!caseId) {
              toast.error("Dosya seçimi geçersiz");
              return;
            }
            upsertExpense({
              title: data.title,
              caseId,
              date: data.date,
              clientId: clientIdByName(data.clientName),
              payer: data.payer || "Büro",
              amount: Number(data.amount) || 0,
              type: data.type,
              status: data.status,
            });
          } else {
            const caseId = caseIdByLabel(data.caseLabel);
            if (!caseId) {
              toast.error("Dosya seçimi geçersiz");
              return;
            }
            upsertPayment({
              caseId,
              date: data.date,
              amount: Number(data.amount) || 0,
              type: data.type || "Havale",
              description: data.description,
              status: data.status,
            });
          }
          toast.success(`${activeAction.label} kaydedildi`);
          setActiveAction(null);
        }}
      />
    </>
  );
}
