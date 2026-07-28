import { useState } from "react";
import { FilePlus2, Receipt, UserPlus, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ManagementEditorDialog,
  type ManagementFormField,
} from "@/components/management/ManagementEditorDialog";
import {
  caseFormFields,
  clientFormFields,
  documentFormFields,
  expenseFormFields,
  paymentFormFields,
} from "@/lib/management-form-config";

const actions = [
  { label: "Yeni Müvekkil", singular: "müvekkil", icon: UserPlus, fields: clientFormFields },
  { label: "Yeni Dosya", singular: "dosya", icon: FilePlus2, fields: caseFormFields },
  { label: "Masraf Ekle", singular: "masraf", icon: Receipt, fields: expenseFormFields },
  { label: "Tahsilat Ekle", singular: "tahsilat", icon: Wallet, fields: paymentFormFields },
  { label: "Evrak Yükle", singular: "evrak", icon: Upload, fields: documentFormFields },
] satisfies Array<{
  label: string;
  singular: string;
  icon: typeof UserPlus;
  fields: ManagementFormField[];
}>;

export function WelcomeHeader() {
  const [activeAction, setActiveAction] = useState<(typeof actions)[number] | null>(null);
  const today = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {today}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Hoş Geldiniz, <span className="text-primary">Av. Ahmet Yılmaz</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bugün büronuzda 3 duruşma, 2 toplantı ve 4 hatırlatma var.
          </p>
        </div>
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
      </div>
      <ManagementEditorDialog
        open={!!activeAction}
        onOpenChange={(open) => !open && setActiveAction(null)}
        title={activeAction?.label ?? "Yeni kayıt"}
        description="İlgili operasyon sayfasındaki alanlarla aynı bilgileri girin."
        fields={activeAction?.fields ?? clientFormFields}
        formId="dashboard"
        onSave={() => {
          toast.success(`${activeAction?.label} kaydedildi`);
          setActiveAction(null);
        }}
      />
    </>
  );
}
