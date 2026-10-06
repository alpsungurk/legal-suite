import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ManagementFormField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date" | "month" | "number" | "file" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  fullWidth?: boolean;
  allowEmpty?: boolean;
  visibleWhen?: {
    field: string;
    equals: string;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: ManagementFormField[];
  values?: Record<string, string | undefined>;
  formId: string;
  onSave: (values: Record<string, string>) => void;
};

const EMPTY_VALUES: Record<string, string | undefined> = {};

function FieldControl({
  field,
  fieldId,
  value,
  onChange,
}: {
  field: ManagementFormField;
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        id={fieldId}
        name={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        className="min-h-[88px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    );
  }

  if (field.type === "select") {
    const emptyValue = "__empty";
    const selectValue = value || (field.allowEmpty ? emptyValue : field.options?.[0] || "");
    return (
      <Select
        value={selectValue}
        onValueChange={(nextValue) => onChange(nextValue === emptyValue ? "" : nextValue)}
      >
        <SelectTrigger
          id={fieldId}
          className="h-10 transition-all duration-200 hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.allowEmpty && <SelectItem value={emptyValue}>Seçilmedi</SelectItem>}
          {field.options?.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      id={fieldId}
      name={field.name}
      type={field.type ?? "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
      className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  );
}

function toFormValues(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? ""]));
}

export function ManagementEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  values = EMPTY_VALUES,
  formId,
  onSave,
}: Props) {
  const [formValues, setFormValues] = useState<Record<string, string>>(() => toFormValues(values));

  useEffect(() => {
    setFormValues(toFormValues(values));
  }, [values, open]);

  const handleFieldChange = (name: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "kind" && value !== "Kurumsal"
        ? { monthlyFee: "", monthlyFeeStartDate: "" }
        : {}),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto border-0 bg-background/95 p-0 shadow-elevated backdrop-blur sm:max-w-2xl">
        <div className="border-b bg-gradient-to-r from-primary/[0.08] via-background to-transparent px-6 py-5">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <form
          key={JSON.stringify(values) + String(open)}
          className="grid gap-4 p-6 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(
              Object.fromEntries(
                fields.map((field) => [
                  field.name,
                  formValues[field.name] ?? (field.allowEmpty ? "" : (field.options?.[0] ?? "")),
                ]),
              ),
            );
          }}
        >
          {fields.map((field, index) => {
            const fieldId = `${formId}-${field.name}`;
            const currentValue = formValues[field.name] ?? "";
            const shouldRender =
              !field.visibleWhen ||
              formValues[field.visibleWhen.field] === field.visibleWhen.equals;

            if (!shouldRender) return null;

            return (
              <div
                key={field.name}
                className={`grid gap-2 animate-in fade-in-0 ${field.fullWidth || field.type === "textarea" ? "sm:col-span-2" : ""}`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <Label
                  htmlFor={fieldId}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {field.label}
                </Label>
                <FieldControl
                  field={field}
                  fieldId={fieldId}
                  value={currentValue}
                  onChange={(nextValue) => handleFieldChange(field.name, nextValue)}
                />
              </div>
            );
          })}
          <DialogFooter className="col-span-full mt-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" className="shadow-soft">
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
