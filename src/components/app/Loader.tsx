import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandImg } from "@/components/app/Brand";

/** Küçük dönen gösterge */
export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-5 w-5";
  return <Loader2 className={cn(sz, "animate-spin text-primary", className)} aria-hidden />;
}

/** Satır içi / kart içi yükleme */
export function InlineLoader({
  label = "Yükleniyor…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** Panel / modal üstü yarı saydam katman */
export function OverlayLoader({
  label = "Yükleniyor…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 grid place-items-center bg-background/70 backdrop-blur-[2px]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy
    >
      <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-6 py-5 shadow-elevated">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Tam sayfa veri yükleme (oturum / sunucu) */
export function PageLoader({ label = "Veriler yükleniyor…" }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white" role="status" aria-busy>
      <div className="flex flex-col items-center gap-3 animate-fade-up">
        <BrandImg
          variant="logo"
          className="h-24 w-24 rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70"
        />
        <Spinner size="md" className="text-[#143064]" />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/** İskelet ızgara — liste/sayfa gövdesi yüklenirken */
export function ContentLoader({
  tiles = 4,
  className,
}: {
  tiles?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)} aria-busy role="status">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="skeleton h-[8.25rem] rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}

export function WithLoading({
  loading,
  label,
  children,
  className,
}: {
  loading: boolean;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {loading ? <OverlayLoader label={label} /> : null}
    </div>
  );
}
