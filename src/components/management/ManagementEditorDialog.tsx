import { useState } from "react";
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
  type?: "text" | "date" | "number" | "file" | "textarea" | "select";
  options?: string[];
  required?: boolean;
  fullWidth?: boolean;
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

function FieldControl({
  field,
  fieldId,
  currentValue,
}: {
  field: ManagementFormField;
  fieldId: string;
  currentValue: string;
}) {
  const [selectValue, setSelectValue] = useState(currentValue || field.options?.[0] || "");

  if (field.type === "textarea") {
    return (
      <Textarea
        id={fieldId}
        name={field.name}
        defaultValue={currentValue}
        placeholder={field.placeholder}
        required={field.required}
      />
    );
  }

  if (field.type === "select") {
    return (
      <>
        <input type="hidden" name={field.name} value={selectValue} />
        <Select value={selectValue} onValueChange={setSelectValue}>
          <SelectTrigger id={fieldId} className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    );
  }

  return (
    <Input
      id={fieldId}
      name={field.name}
      type={field.type ?? "text"}
      defaultValue={field.type === "file" ? undefined : currentValue}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
}

export function ManagementEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  values = {},
  formId,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          key={JSON.stringify(values) + String(open)}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const nextValues = Object.fromEntries(
              fields.map((field) => [field.name, String(formData.get(field.name) ?? "")]),
            );
            onSave(nextValues);
          }}
        >
          {fields.map((field) => {
            const fieldId = `${formId}-${field.name}`;
            const currentValue = values[field.name] ?? "";
            return (
              <div
                key={field.name}
                className={`grid gap-2 ${field.fullWidth || field.type === "textarea" ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={fieldId}>{field.label}</Label>
                <FieldControl field={field} fieldId={fieldId} currentValue={currentValue} />
              </div>
            );
          })}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit">Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
