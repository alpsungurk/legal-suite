import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Combobox,
  MoneyInput,
  MultiCombobox,
  Segmented,
  toOptions,
  type Option,
} from "@/components/app/fields";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormValues = Record<string, any>;

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "time"
  | "select"
  | "combobox"
  | "multiselect"
  | "segmented"
  | "switch";

export type FormField = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  options?: Array<string | Option>;
  /** 2: tam genişlik */
  span?: 1 | 2;
  visible?: (v: FormValues) => boolean;
  /** Değer değişince diğer alanları güncellemek için */
  onChange?: (value: unknown, values: FormValues) => Partial<FormValues>;
  allowClear?: boolean;
  autoFocus?: boolean;
  /** Bölüm başlığı (alanın üstünde gösterilir) */
  section?: string;
};

export type FormErrors = Record<string, string>;

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitLabel = "Kaydet",
  validate,
  onSubmit,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  initial: FormValues;
  submitLabel?: string;
  validate?: (v: FormValues) => FormErrors | undefined;
  /** false dönerse dialog açık kalır */
  onSubmit: (v: FormValues) => void | boolean | Promise<void | boolean>;
  wide?: boolean;
  /** Alanların altına ek içerik (ör. önizleme tablosu) */
  children?: (v: FormValues, set: (patch: Partial<FormValues>) => void) => ReactNode;
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const formId = useId();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<FormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const setField = (f: FormField, value: unknown) => {
    const derived = f.onChange?.(value, { ...values, [f.name]: value }) ?? {};
    set({ [f.name]: value, ...derived });
  };

  const visibleFields = fields.filter((f) => !f.visible || f.visible(values));

  const submit = async () => {
    const errs: FormErrors = {};
    for (const f of visibleFields) {
      if (!f.required) continue;
      const v = values[f.name];
      const empty =
        v == null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (f.type === "money" && !(Number(v) > 0));
      if (empty) errs[f.name] = f.type === "money" ? "Tutar girin" : "Zorunlu alan";
    }
    Object.assign(errs, validate?.(values) ?? {});
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await onSubmit(values);
      if (res !== false) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[92svh] flex-col gap-0 overflow-hidden",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <DialogHeader className="border-b border-border/60 px-6 pb-4 pt-5 text-left">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          id={formId}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {visibleFields.map((f) => (
              <FieldBlock
                key={f.name}
                field={f}
                value={values[f.name]}
                error={errors[f.name]}
                onChange={(v) => setField(f, v)}
              />
            ))}
          </div>
          {children && <div className="mt-5">{children(values, set)}</div>}
          {errors._form && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive animate-fade-up">
              {errors._form}
            </p>
          )}
        </form>
        <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-6 py-3.5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldBlock({
  field: f,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${f.name}`;
  const type = f.type ?? "text";
  const span = f.span === 2 || type === "textarea" || type === "segmented" ? "sm:col-span-2" : "";
  const options = toOptions(f.options ?? []);
  const invalid = !!error;

  let control: ReactNode;
  switch (type) {
    case "textarea":
      control = (
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          rows={3}
        />
      );
      break;
    case "money":
      control = (
        <MoneyInput
          id={id}
          value={value as number}
          onChange={onChange}
          invalid={invalid}
          autoFocus={f.autoFocus}
        />
      );
      break;
    case "number":
      control = (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={(value as number | string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          aria-invalid={invalid || undefined}
        />
      );
      break;
    case "select":
      control = (
        <Select value={(value as string) || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} aria-invalid={invalid || undefined}>
            <SelectValue placeholder={f.placeholder ?? "Seçin"} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "combobox":
      control = (
        <Combobox
          id={id}
          value={value as string}
          onChange={onChange}
          options={options}
          placeholder={f.placeholder}
          allowClear={f.allowClear}
          invalid={invalid}
        />
      );
      break;
    case "multiselect":
      control = (
        <MultiCombobox
          value={(value as string[]) ?? []}
          onChange={onChange}
          options={options}
          placeholder={f.placeholder}
          invalid={invalid}
        />
      );
      break;
    case "segmented":
      control = <Segmented value={(value as string) ?? ""} onChange={onChange} options={options} />;
      break;
    case "switch":
      return (
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/80 bg-secondary/30 px-3.5 py-3 transition-colors hover:bg-secondary/60",
            span || "sm:col-span-2",
          )}
        >
          <span>
            <span className="block text-sm font-medium">{f.label}</span>
            {f.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{f.hint}</span>}
          </span>
          <Switch id={id} checked={!!value} onCheckedChange={onChange} />
        </label>
      );
    default:
      control = (
        <Input
          id={id}
          type={type}
          autoFocus={f.autoFocus}
          value={(value as string) ?? ""}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
        />
      );
  }

  return (
    <div className={cn("min-w-0 space-y-1.5", span)}>
      {f.section && (
        <p className="-mb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {f.section}
        </p>
      )}
      <label
        htmlFor={id}
        className="flex items-center gap-1 text-[13px] font-medium text-foreground/90"
      >
        {f.label}
        {f.required && <span className="text-destructive">*</span>}
      </label>
      {control}
      {error ? (
        <p className="text-xs font-medium text-destructive animate-fade-up">{error}</p>
      ) : f.hint ? (
        <p className="text-xs text-muted-foreground">{f.hint}</p>
      ) : null}
    </div>
  );
}
