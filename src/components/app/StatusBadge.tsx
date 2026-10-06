import { cn } from "@/lib/utils";

export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "slate";

const toneClass: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground ring-border",
  slate:
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700",
  blue: "bg-blue-50 text-blue-700 ring-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900",
  green:
    "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  amber:
    "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  red: "bg-rose-50 text-rose-700 ring-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
  cyan: "bg-cyan-50 text-cyan-800 ring-cyan-200/80 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-900",
};

const dotClass: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

/** Bilinen durum metinleri için otomatik renk. */
const STATUS_TONES: Record<string, Tone> = {
  // genel
  Aktif: "green",
  Pasif: "slate",
  Bekliyor: "amber",
  Tamamlandı: "green",
  İptal: "slate",
  // dosya
  Açık: "blue",
  Derdest: "violet",
  Karar: "cyan",
  "Kanun yolu": "amber",
  Kapalı: "slate",
  // finans
  Ödendi: "green",
  Kısmi: "blue",
  Gecikmiş: "red",
  "Devam ediyor": "blue",
  Borçlu: "red",
  Alacaklı: "green",
  Avans: "green",
  İade: "amber",
  Müvekkil: "violet",
  Büro: "slate",
  Belgeli: "green",
  Belgesiz: "amber",
  // icra
  Haciz: "red",
  Satış: "violet",
  "Ödeme planı": "blue",
  "Tahsil edildi": "green",
  Tutuldu: "green",
  Tutulmadı: "red",
  // belge talebi
  Yüklendi: "green",
  Kapatıldı: "slate",
  // roller
  Admin: "blue",
  Avukat: "violet",
  Sekreter: "amber",
  // ajanda
  Duruşma: "violet",
  "Süre sonu": "red",
  Keşif: "cyan",
  Toplantı: "blue",
  // aktivite
  Ekleme: "green",
  Güncelleme: "blue",
  Silme: "red",
  İşlem: "violet",
};

export function toneFor(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

export function StatusBadge({
  status,
  tone,
  dot = true,
  className,
  children,
}: {
  status?: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = tone ?? toneFor(status ?? "");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        toneClass[t],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[t])} />}
      {children ?? status}
    </span>
  );
}

export function toneTextClass(t: Tone) {
  return {
    neutral: "text-muted-foreground",
    slate: "text-slate-500",
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
    violet: "text-violet-600 dark:text-violet-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
  }[t];
}

export function toneSoftClass(t: Tone) {
  return {
    neutral: "bg-secondary text-muted-foreground",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    red: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  }[t];
}

export function ReliabilityBadge({ value }: { value: number | null }) {
  if (value == null) return <StatusBadge tone="slate">Veri yok</StatusBadge>;
  const pct = Math.round(value * 100);
  return (
    <StatusBadge tone={pct >= 75 ? "green" : pct >= 40 ? "amber" : "red"}>
      %{pct} sadakat
    </StatusBadge>
  );
}
