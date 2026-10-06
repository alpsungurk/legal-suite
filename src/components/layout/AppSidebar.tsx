import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Wallet,
  BellRing,
  BarChart3,
  Bell,
  Settings,
  Scale,
  Landmark,
  History,
  CalendarClock,
  ChevronRight,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useErp } from "@/lib/erp-store";

const flatItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Müvekkiller", url: "/muvekkiller", icon: Users },
  { title: "Tahsilatlar", url: "/tahsilatlar", icon: Wallet },
  { title: "Taksitler", url: "/taksitler", icon: CalendarClock },
  { title: "Cari Hesap", url: "/cari-hesap", icon: Landmark },
  { title: "Hatırlatmalar", url: "/hatirlatmalar", icon: BellRing },
  { title: "Raporlar", url: "/raporlar", icon: BarChart3 },
  { title: "Bildirimler", url: "/bildirimler", icon: Bell },
  { title: "Aktivite Geçmişi", url: "/aktivite", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const search = useRouterState({ select: (r) => r.location.search });
  const navigate = useNavigate();
  const { state: erp, currentUser, permissions } = useErp();

  useEffect(() => {
    if (!permissions.canAccessSettings && pathname.startsWith("/ayarlar")) {
      navigate({ to: "/" });
    }
  }, [permissions.canAccessSettings, pathname, navigate]);

  const turParam =
    typeof search === "object" && search && "tur" in search
      ? String((search as { tur?: string }).tur ?? "")
      : "";

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  const visibleFlatItems = flatItems.filter((item) => {
    if (item.url === "/aktivite") {
      return permissions.canViewActivityHistory;
    }
    if (item.url === "/tahsilatlar") {
      return permissions.canViewPayments;
    }
    if (["/taksitler", "/cari-hesap", "/raporlar"].includes(item.url)) {
      return permissions.canViewFinance;
    }
    return true;
  });

  const initials = currentUser.name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr");

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
              {visibleFlatItems.slice(0, 2).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                  >
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Collapsible
                asChild
                defaultOpen={pathname.startsWith("/dosyalar")}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Dosyalar"
                      isActive={pathname.startsWith("/dosyalar")}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                    >
                      <FolderKanban className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">Dosyalar</span>}
                      {!collapsed && (
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={pathname === "/dosyalar" && !turParam}
                          >
                            <Link to="/dosyalar">Tümü</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        {erp.caseTypes.map((type) => (
                          <SidebarMenuSubItem key={type}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === "/dosyalar" && turParam === type}
                            >
                              <Link to="/dosyalar" search={{ tur: type }}>
                                {type}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {permissions.canViewFinance && (
                <Collapsible
                  asChild
                  defaultOpen={pathname.startsWith("/masraflar")}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Masraflar"
                        isActive={pathname.startsWith("/masraflar")}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                      >
                        <Receipt className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">Masraflar</span>}
                        {!collapsed && (
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === "/masraflar" && !turParam}
                            >
                              <Link to="/masraflar">Tümü</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          {erp.expenseTypes.map((type) => (
                            <SidebarMenuSubItem key={type}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === "/masraflar" && turParam === type}
                              >
                                <Link to="/masraflar" search={{ tur: type }}>
                                  {type}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              )}

              {visibleFlatItems.slice(2).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                  >
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {permissions.canAccessSettings && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/ayarlar")}
                    tooltip="Ayarlar"
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-soft hover:bg-sidebar-accent"
                  >
                    <Link to="/ayarlar" className="flex items-center gap-3">
                      <Settings className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">Ayarlar</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-1 py-1.5 group-data-[collapsible=icon]:px-0">
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-primary/30">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {currentUser.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/60">
                {currentUser.role}
              </span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
