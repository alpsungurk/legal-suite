import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseMoney } from "@/lib/format";

export type Option = { value: string; label: string; hint?: string };

export function toOptions(opts: Array<string | Option>): Option[] {
  return opts.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

/* ───────────── Para girişi ───────────── */

const grouped = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0",
  invalid,
  autoFocus,
}: {
  value: number | undefined | null;
  onChange: (n: number) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value ? grouped(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value ? grouped(value) : "");
  }, [value, focused]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₺
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        className="money pl-7 text-right font-medium"
        placeholder={placeholder}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const n = parseMoney(text);
          setText(n ? grouped(n) : "");
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setText(raw);
          onChange(parseMoney(raw));
        }}
      />
    </div>
  );
}

/* ───────────── Aranabilir seçim ───────────── */

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seçin",
  searchPlaceholder = "Ara...",
  emptyText = "Sonuç yok",
  allowClear,
  invalid,
  id,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 aria-[invalid=true]:border-destructive",
            open && "border-ring ring-[3px] ring-ring/20",
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground/70")}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && selected && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Temizle"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground/70" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      o.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────── Çoklu seçim ───────────── */

export function MultiCombobox({
  value,
  onChange,
  options,
  placeholder = "Seçin",
  invalid,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 text-left text-sm shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 aria-[invalid=true]:border-destructive",
            open && "border-ring ring-[3px] ring-ring/20",
          )}
        >
          {value.length === 0 && (
            <span className="px-1 text-muted-foreground/70">{placeholder}</span>
          )}
          {value.map((v) => {
            const o = options.find((x) => x.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium animate-pop"
              >
                {o?.label ?? v}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            );
          })}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Ara..." />
          <CommandList className="max-h-64">
            <CommandEmpty>Sonuç yok</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => toggle(o.value)}
                  className="gap-2"
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 place-items-center rounded border",
                      value.includes(o.value)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {value.includes(o.value) && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────── Segment buton ───────────── */

export function Segmented({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex w-full rounded-lg border border-border bg-secondary/60 p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-3 font-medium transition-all duration-200",
              size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
              active
                ? "bg-card text-foreground shadow-soft ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
