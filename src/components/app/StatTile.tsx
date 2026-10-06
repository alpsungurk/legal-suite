import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toneSoftClass, toneTextClass, type Tone } from "@/components/app/StatusBadge";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  hintTone,
  to,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hintTone?: Tone;
  to?: string;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-soft sm:p-5",
        to && "interactive-card cursor-pointer",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110",
              toneSoftClass(tone),
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <p className="money mt-2 text-2xl font-bold tracking-tight sm:text-[1.65rem]">{value}</p>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            hintTone ? toneTextClass(hintTone) : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
  return to ? (
    <Link
      to={to}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("stagger grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>
  );
}
