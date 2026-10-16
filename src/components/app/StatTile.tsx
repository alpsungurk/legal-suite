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
        "stat-card group @container relative flex h-full min-h-[8.25rem] min-w-0 flex-col",
        "rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft sm:p-4",
        to && "cursor-pointer",
        className,
      )}
    >
      <div className="flex h-9 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium leading-none text-muted-foreground @[11rem]:text-[14px]">
          {label}
        </p>
        <span
          className={cn(
            "stat-card-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            Icon ? toneSoftClass(tone) : "invisible",
          )}
          aria-hidden={!Icon}
        >
          {Icon ? <Icon className="h-[18px] w-[18px]" /> : null}
        </span>
      </div>

      <p
        className="money mt-3 break-words font-bold leading-none tracking-tight"
        style={{ fontSize: "clamp(1.15rem, 9.5cqw, 1.65rem)" }}
      >
        {value}
      </p>

      <p
        className={cn(
          "mt-auto pt-2 line-clamp-2 min-h-[2.25rem] text-[12.5px] font-medium leading-snug @[11rem]:text-xs",
          hintTone ? toneTextClass(hintTone) : "text-muted-foreground",
        )}
      >
        {hint ?? "\u00a0"}
      </p>
    </div>
  );

  return to ? (
    <Link
      to={to}
      className="stat-tile-cell block h-full min-w-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      {body}
    </Link>
  ) : (
    <div className="stat-tile-cell h-full min-w-0">{body}</div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "stagger grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
