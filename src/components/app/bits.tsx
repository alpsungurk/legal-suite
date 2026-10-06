/** Küçük, sık kullanılan görsel parçalar. */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, initials } from "@/lib/format";
import { Card } from "@/components/ui/card";

export function Money({
  value,
  className,
  signed,
  colored,
}: {
  value: number;
  className?: string;
  signed?: boolean;
  colored?: boolean;
}) {
  const text = signed && value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
  return (
    <span
      className={cn(
        "money whitespace-nowrap",
        colored && value > 0 && "text-emerald-600 dark:text-emerald-400",
        colored && value < 0 && "text-rose-600 dark:text-rose-400",
        className,
      )}
    >
      {text}
    </span>
  );
}

const avatarColors = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
];

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sz = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  }[size];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        sz,
        colorFor(name),
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  if (!names.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex -space-x-1.5">
      {names.slice(0, max).map((n) => (
        <span key={n} title={n} className="rounded-full ring-2 ring-card">
          <Avatar name={n} size="xs" />
        </span>
      ))}
      {names.length > max && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-semibold ring-2 ring-card">
          +{names.length - max}
        </span>
      )}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "green" | "amber" | "red";
  className?: string;
}) {
  const bar = {
    primary: "bg-primary",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div
        className={cn("progress-bar h-full rounded-full", bar)}
        style={{ width: `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%` }}
      />
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden animate-fade-up", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function DetailList({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium">{it.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TextLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function NoAccess() {
  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-dashed p-8 text-center animate-fade-up">
      <p className="text-sm font-semibold">Bu sayfaya erişim yetkiniz yok</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Yetki için büro yöneticinizle iletişime geçin.
      </p>
    </div>
  );
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-[1440px] space-y-6", className)}>
      {children}
    </div>
  );
}
