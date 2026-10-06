import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Moon, Settings, Sun, User } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
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
import { useErp } from "@/lib/erp-store";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/muvekkiller": "Müvekkiller",
  "/dosyalar": "Dosyalar",
  "/masraflar": "Masraflar",
  "/tahsilatlar": "Tahsilatlar",
  "/taksitler": "Taksit Takibi",
  "/cari-hesap": "Cari Hesap",
  "/hatirlatmalar": "Hatırlatmalar",
  "/raporlar": "Raporlar",
  "/bildirimler": "Bildirimler",
  "/aktivite": "Aktivite Geçmişi",
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[pathname] ?? "Dashboard";
  const { currentUser, state, permissions, markAllNotificationsRead, logout } = useErp();

  const unread = state.notifications.filter((n) => n.userId === currentUser.id && !n.read).length;

  const initials = currentUser.name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr");

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-6">
      <SidebarTrigger className="h-9 w-9 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />

        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Bildirimler"
          onClick={() => {
            markAllNotificationsRead();
            navigate({ to: "/bildirimler" });
          }}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 rounded-lg px-1.5 sm:pr-3">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{currentUser.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="text-sm">{currentUser.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{currentUser.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/ayarlar" })}>
              <User className="mr-2 h-4 w-4" /> Profil
            </DropdownMenuItem>
            {permissions.canAccessSettings && (
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
              <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export { Badge };
