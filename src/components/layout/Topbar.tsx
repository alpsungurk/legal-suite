import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarPlus,
  CheckCheck,
  FilePlus2,
  Gavel,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  Settings,
  Sun,
  UserPlus,
  Wallet,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useErp } from "@/lib/erp-store";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, Kbd } from "@/components/app/bits";
import { useQuick } from "@/components/forms/quick";
import { openCommandPalette } from "@/components/layout/CommandPalette";
import { pageTitle } from "@/components/layout/nav";

/* ───────────── Tema ───────────── */

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "lex-theme";

function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      setPref((localStorage.getItem(THEME_KEY) as ThemePref) || "system");
    } catch {
      /* yoksay */
    }
  }, []);
  const update = (p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* yoksay */
    }
    applyTheme(p);
  };
  return { pref, update };
}

export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export function ThemeMenu() {
  const { pref, update } = useTheme();
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Tema">
          <Icon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {(
          [
            ["light", "Açık", Sun],
            ["dark", "Koyu", Moon],
            ["system", "Sistem", Monitor],
          ] as const
        ).map(([v, label, I]) => (
          <DropdownMenuItem
            key={v}
            onClick={() => update(v)}
            className={cn(pref === v && "font-semibold")}
          >
            <I className="mr-2 h-4 w-4" /> {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────── Bildirimler ───────────── */

function NotificationsButton() {
  const { state, currentUser, markNotificationsRead } = useErp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = state.notifications.filter((n) => n.userId === currentUser.id).slice(0, 8);
  const unread = state.notifications.filter((n) => n.userId === currentUser.id && !n.read).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label="Bildirimler"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-background animate-pop">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Bildirimler</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markNotificationsRead()}
            >
              <CheckCheck /> Tümünü okundu say
            </Button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {mine.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Bildirim yok</p>
          )}
          {mine.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                markNotificationsRead([n.id]);
                setOpen(false);
                if (n.link) navigate({ to: n.link });
              }}
              className="flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/60"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  n.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {timeAgo(n.createdAt)}
              </span>
            </button>
          ))}
        </div>
        <Link
          to="/bildirimler"
          onClick={() => setOpen(false)}
          className="block border-t border-border/60 px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-secondary/50"
        >
          Tüm bildirimler ve uyarılar
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────── Hızlı ekle ───────────── */

export function QuickAddMenu({ trigger }: { trigger?: React.ReactNode }) {
  const quick = useQuick();
  const { permissions } = useErp();
  const items = [
    { kind: "expense" as const, label: "Masraf", icon: Receipt, show: permissions.addExpense },
    {
      kind: "plan" as const,
      label: "Tahsilat planı",
      icon: Wallet,
      show: permissions.manageFinance,
    },
    {
      kind: "advance" as const,
      label: "Masraf avansı",
      icon: PiggyBank,
      show: permissions.manageFinance,
    },
    { kind: "reminder" as const, label: "Ajanda kaydı", icon: CalendarPlus, show: true },
    { kind: "client" as const, label: "Müvekkil", icon: UserPlus, show: permissions.manageRecords },
    { kind: "case" as const, label: "Dosya", icon: FilePlus2, show: permissions.manageRecords },
    {
      kind: "enforcement" as const,
      label: "İcra dosyası",
      icon: Gavel,
      show: permissions.manageRecords,
    },
  ].filter((i) => i.show);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="h-9 gap-1.5 px-3">
            <Plus /> <span className="hidden sm:inline">Yeni</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Hızlı ekle</DropdownMenuLabel>
        {items.map((i) => (
          <DropdownMenuItem
            key={i.kind}
            onClick={() => quick.open(i.kind)}
            className="gap-2.5 py-2"
          >
            <i.icon className="h-4 w-4 text-muted-foreground" /> {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────── Topbar ───────────── */

export function Topbar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { currentUser, permissions, logout } = useErp();

  return (
    <header className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:h-16 sm:gap-3 sm:px-6">
      <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground" />
      <h1 className="truncate text-[15px] font-semibold tracking-tight md:hidden">
        {pageTitle(pathname)}
      </h1>

      <button
        type="button"
        onClick={openCommandPalette}
        className="group ml-1 hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-border/80 bg-secondary/40 px-3 text-sm text-muted-foreground transition-all hover:border-foreground/15 hover:bg-secondary/70 md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Ara veya işlem seç...</span>
        <span className="flex items-center gap-0.5">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground md:hidden"
          onClick={openCommandPalette}
          aria-label="Ara"
        >
          <Search className="h-[18px] w-[18px]" />
        </Button>
        <div className="hidden md:block">
          <QuickAddMenu />
        </div>
        <ThemeMenu />
        <NotificationsButton />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 rounded-lg px-1.5 sm:pr-2.5">
              <Avatar name={currentUser.name} size="sm" />
              <span className="hidden max-w-[140px] truncate text-sm font-medium lg:inline">
                {currentUser.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-3 py-2">
              <Avatar name={currentUser.name} />
              <span className="min-w-0">
                <span className="block truncate text-sm">{currentUser.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {currentUser.email}
                </span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate({ to: "/ayarlar", search: { sekme: "hesabim" } })}
            >
              <KeyRound className="mr-2 h-4 w-4" /> Hesabım ve şifre
            </DropdownMenuItem>
            {permissions.manageSettings && (
              <DropdownMenuItem onClick={() => navigate({ to: "/ayarlar" })}>
                <Settings className="mr-2 h-4 w-4" /> Ayarlar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                logout();
                navigate({ to: "/giris" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
