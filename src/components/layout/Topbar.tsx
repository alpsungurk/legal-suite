import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Moon, Search, Settings, Sun, User } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/muvekkiller": "Müvekkiller",
  "/dosyalar": "Dosyalar",
  "/masraflar": "Masraflar",
  "/tahsilatlar": "Tahsilatlar",
  "/evraklar": "Evraklar",
  "/hatirlatmalar": "Hatırlatmalar",
  "/raporlar": "Raporlar",
  "/bildirimler": "Bildirimler",
  "/ayarlar": "Ayarlar",
};

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="rounded-lg text-muted-foreground hover:text-foreground"
      aria-label="Tema değiştir"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </Button>
  );
}

export function Topbar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-6">
      <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Müvekkil, dosya, evrak ara..."
            className="h-9 w-64 rounded-lg border-border bg-secondary/60 pl-9 pr-14 text-sm shadow-none focus-visible:ring-1 lg:w-80"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>

        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Bildirimler"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            5
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 rounded-lg px-1.5 sm:pr-3">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                  AY
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">Ahmet Yılmaz</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">Av. Ahmet Yılmaz</span>
              <span className="text-xs font-normal text-muted-foreground">
                ahmet@lexyonetim.com
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" /> Profil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Ayarlar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export { Badge };
