import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center animate-fade-up",
        compact ? "py-8" : "py-14",
        className,
      )}
    >
      <div className="relative mb-1">
        <div className="absolute inset-0 scale-150 rounded-full bg-primary/5 blur-xl" />
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-border/80 bg-card text-muted-foreground shadow-soft">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
