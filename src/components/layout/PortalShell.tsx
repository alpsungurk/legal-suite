import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FileText, FolderKanban, Home, LogOut, MessagesSquare, Receipt, Scale } from "lucide-react";
import { useErp } from "@/lib/erp-store";
import { Avatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { ThemeMenu } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";

export function PortalShell({ children }: { children: ReactNode }) {
  const { state, currentUser, logout } = useErp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const client = state.clients.find((c) => c.id === currentUser.clientId);
  const unread = state.messages.filter(
    (m) => m.clientId === currentUser.clientId && !m.readByClient,
  ).length;
  const pendingReq = state.docRequests.filter(
    (r) => r.clientId === currentUser.clientId && r.status === "Bekliyor",
  ).length;

  const items = [
    { to: "/portal", label: "Özet", icon: Home },
    { to: "/portal/dosyalar", label: "Dosyalarım", icon: FolderKanban },
    ...(client?.portalShowStatement
      ? [{ to: "/portal/ekstre", label: "Hesap ekstresi", icon: Receipt }]
      : []),
    { to: "/portal/belgeler", label: "Belgeler", icon: FileText, badge: pendingReq },
    { to: "/portal/mesajlar", label: "Mesajlar", icon: MessagesSquare, badge: unread },
  ];

  const active = (to: string) =>
    to === "/portal" ? pathname === "/portal" : pathname.startsWith(to);

  return (
    <div className="min-h-svh bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/portal" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#d4b483] to-[#a67c42] text-[#0c1c3f]">
              <Scale className="h-[18px] w-[18px]" />
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-semibold">{state.settings.firm.name}</span>
              <span className="block text-[11px] text-muted-foreground">Müvekkil portalı</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "relative flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  active(i.to)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {i.label}
                {!!i.badge && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {i.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeMenu />
            <div className="hidden items-center gap-2 pl-1 sm:flex">
              <Avatar name={currentUser.name} size="sm" />
              <span className="max-w-[140px] truncate text-sm font-medium">{currentUser.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Çıkış"
              className="text-muted-foreground"
              onClick={() => {
                logout();
                navigate({ to: "/giris" });
              }}
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">{children}</main>
      {/* Mobil alt menü */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active(i.to) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <i.icon className="h-5 w-5" />
            {i.label.split(" ")[0]}
            {!!i.badge && (
              <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
