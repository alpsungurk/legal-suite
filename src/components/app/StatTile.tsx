import type { LucideIcon } from "lucide-react";
import { Children, Fragment, isValidElement, type ReactNode } from "react";
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
        // overflow-hidden: dar ekranda hiçbir yazı kartın dışına taşmaz
        "stat-card group @container relative flex h-full min-h-[8.25rem] min-w-0 flex-col overflow-hidden",
        "rounded-2xl border border-border/80 bg-card p-3.5 shadow-soft sm:p-4",
        to && "stat-card-link cursor-pointer",
        className,
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-2">
        {/* Uzun başlık (ör. "İcra tahsilatı (aktarılmamış)") iki satıra iner */}
        <p
          className="line-clamp-2 min-w-0 text-xs font-medium leading-tight text-muted-foreground @[11rem]:text-[14px]"
          title={label}
        >
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

      {/* Tutar kart genişliğine göre küçülür; yine sığmazsa satır kırılır */}
      <p
        className="money mt-3 font-bold leading-tight tracking-tight [overflow-wrap:anywhere]"
        style={{ fontSize: "clamp(0.95rem, 8.5cqw, 1.65rem)" }}
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

/** Görünen kart sayısı (koşullu <>…</> grupları açılarak) */
function tileCount(children: ReactNode): number {
  return Children.toArray(children).reduce<number>(
    (n, c) =>
      n +
      (isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment
        ? tileCount(c.props.children)
        : 1),
    0,
  );
}

/**
 * Kart sayısına göre sütun: 4 kart telefonda ve orta genişlikte 2×2, geniş ekranda tek sıra
 * (yan menü açıkken 1024 px'te 4 sütun kartları sıkıştırıp yazıyı taşırıyordu).
 */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  6: "grid-cols-2 md:grid-cols-3 2xl:grid-cols-6",
};

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  const n = tileCount(children);
  return (
    <div
      className={cn(
        "stagger grid auto-rows-fr gap-3",
        GRID_COLS[n] ?? "grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
