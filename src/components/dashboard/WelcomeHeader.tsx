import { FilePlus2, Receipt, UserPlus, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { label: "Yeni Müvekkil", icon: UserPlus },
  { label: "Yeni Dosya", icon: FilePlus2 },
  { label: "Masraf Ekle", icon: Receipt },
  { label: "Tahsilat Ekle", icon: Wallet },
  { label: "Evrak Yükle", icon: Upload },
];

export function WelcomeHeader() {
  const today = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {today}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Hoş Geldiniz, <span className="text-primary">Av. Ahmet Yılmaz</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bugün büronuzda 3 duruşma, 2 toplantı ve 4 hatırlatma var.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => (
          <Button
            key={a.label}
            variant={i === 0 ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5 rounded-lg font-medium shadow-soft"
          >
            <a.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{a.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
