import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Wallet,
  FileText,
  BellRing,
  BarChart3,
  Bell,
  Settings,
  Scale,
  Landmark,
  History,
  Search,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Müvekkiller", url: "/muvekkiller", icon: Users },
  { title: "Dosyalar", url: "/dosyalar", icon: FolderKanban },
  { title: "Masraflar", url: "/masraflar", icon: Receipt },
  { title: "Tahsilatlar", url: "/tahsilatlar", icon: Wallet },
  { title: "Cari Hesap", url: "/cari-hesap", icon: Landmark },
  { title: "Evraklar", url: "/evraklar", icon: FileText },
  { title: "Hatırlatmalar", url: "/hatirlatmalar", icon: BellRing },
  { title: "Raporlar", url: "/raporlar", icon: BarChart3 },
  { title: "Bildirimler", url: "/bildirimler", icon: Bell },
  { title: "Aktivite Geçmişi", url: "/aktivite", icon: History },
  { title: "Global Arama", url: "/arama", icon: Search },
  { title: "Ayarlar", url: "/ayarlar", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2 py-2 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:px-0"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-soft">
            <Scale className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                Lex Yönetim
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/60">
                Hukuk Büro Paneli
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/50">Menü</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.url === "/"
                    ? pathname === "/"
                    : pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-1 py-1.5 group-data-[collapsible=icon]:px-0">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/30">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
              AY
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                Av. Ahmet Yılmaz
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/60">Yönetici</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
