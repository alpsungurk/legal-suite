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
        ...(permissions.canCreateClients
          ? [
              {
                label: "Yeni Müvekkil",
                singular: "müvekkil",
                icon: UserPlus,
                fields: buildClientFormFields(),
                kind: "client" as const,
              },
            ]
          : []),
        ...(permissions.canCreateCases
          ? [
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
            ]
          : []),
        ...(permissions.canManageFinance
          ? [
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
            ]
          : []),
      ] satisfies Array<{
        label: string;
        singular: string;
        icon: typeof UserPlus;
        fields: ManagementFormField[];
        kind: "client" | "case" | "expense" | "payment";
      }>,
    [clientOptions, caseOptions, userOptions, state.caseTypes, state.expenseTypes, permissions],
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
            {permissions.canViewFinance
              ? `Büro genelindeki finans ve operasyon özetiniz hazır. ${myReminders} açık hatırlatmanız var.`
              : `Müvekkil ve dosya çalışmalarınız hazır. Size atanmış ${myReminders} açık hatırlatma var.`}
          </p>
        </div>
        {(permissions.canCreateClients ||
          permissions.canCreateCases ||
          permissions.canManageFinance) && (
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
            const monthlyFee = Number(data.monthlyFee) || 0;
            if (data.kind === "Kurumsal" && monthlyFee > 0 && !data.monthlyFeeStartDate) {
              toast.error("Aylık ücret takibi için başlangıç tarihi girin");
              return;
            }
            upsertClient({
              name: data.name,
              email: data.email,
              phone: data.phone,
              kind: (data.kind as "Bireysel" | "Kurumsal") || "Bireysel",
              identity: data.identity,
              address: data.address,
              monthlyFee,
              monthlyFeeStartDate:
                data.kind === "Kurumsal" && monthlyFee > 0 ? data.monthlyFeeStartDate : undefined,
              status: data.status === "Pasif" ? "Pasif" : "Aktif",
            });
          } else if (activeAction.kind === "case") {
            const clientId = clientIdByName(data.clientName);
            if (!clientId) {
              toast.error("Müvekkil seçimi geçersiz");
              return;
            }
            upsertCase({
              no: data.no,
              title: data.title,
              clientId,
              court: data.court,
              type: data.type,
              openingDate: data.openingDate,
              note: data.note,
            });
          } else if (activeAction.kind === "expense") {
            const caseId = data.caseLabel ? caseIdByLabel(data.caseLabel) : undefined;
            const clientId =
              (data.clientName ? clientIdByName(data.clientName) : undefined) ??
              (caseId ? state.cases.find((item) => item.id === caseId)?.clientId : undefined);
            if (!caseId && !clientId) {
              toast.error("Dosya veya müvekkil seçimi gerekli");
              return;
            }
            upsertExpense({
              title: data.title,
              caseId,
              date: data.date,
              clientId,
              payer: data.payer || "Büro",
              amount: Number(data.amount) || 0,
              type: data.type,
              status: data.status,
              direction: (data.direction as "Gelen" | "Giden") || "Giden",
              recordDate: data.recordDate,
            });
          } else {
            const caseId = data.caseLabel ? caseIdByLabel(data.caseLabel) : undefined;
            const clientId =
              (data.clientName ? clientIdByName(data.clientName) : undefined) ??
              (caseId ? state.cases.find((item) => item.id === caseId)?.clientId : undefined);
            if (!caseId && !clientId) {
              toast.error("Dosya veya müvekkil seçimi gerekli");
              return;
            }
            const countMap: Record<string, number> = {
              "2 taksit": 2,
              "3 taksit": 3,
              "6 taksit": 6,
              "12 taksit": 12,
            };
            const count = countMap[data.taksitPlan] ?? 0;
            const amount = Number(data.amount) || 0;
            const eachAmount = count ? Math.floor(amount / count) : 0;
            const remainder = count ? amount - eachAmount * count : 0;
            const installments = count
              ? Array.from({ length: count }, (_, index) => {
                  const [year, month, day] = data.date.split("-").map(Number);
                  const monthIndex = month - 1 + index + 1;
                  const dueYear = year + Math.floor(monthIndex / 12);
                  const dueMonth = ((monthIndex % 12) + 12) % 12;
                  const dueDay = Math.min(
                    day,
                    new Date(Date.UTC(dueYear, dueMonth + 1, 0)).getUTCDate(),
                  );
                  return {
                    id: `quick-${Date.now()}-${index + 1}`,
                    amount: eachAmount + (index === count - 1 ? remainder : 0),
                    dueDate: new Date(Date.UTC(dueYear, dueMonth, dueDay))
                      .toISOString()
                      .slice(0, 10),
                    status: "Bekliyor" as const,
                  };
                })
              : undefined;
            upsertPayment({
              caseId,
              clientId,
              date: data.date,
              amount,
              type: data.type || "Peşin",
              description: "Yasal vekalet ücreti",
              status: data.status,
              installments,
            });
          }
          toast.success(`${activeAction.label} kaydedildi`);
          setActiveAction(null);
        }}
      />
    </>
  );
}
