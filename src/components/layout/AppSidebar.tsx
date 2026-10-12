import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  FolderOpen,
  Gavel,
  History,
  Landmark,
  LayoutDashboard,
  Receipt,
  Settings,
  UserX,
  Users,
  Wallet,
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";
import { BrandImg, FirmMark } from "@/components/app/Brand";
import { BRAND } from "@/lib/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useErp } from "@/lib/erp-store";
import { allInstallments, promiseStatus } from "@/lib/finance";
import { today } from "@/lib/format";
import type { Permissions } from "@/lib/erp-types";
import { cn } from "@/lib/utils";

type Item = {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: "red" | "blue";
};
type Group = { label: string; items: Item[] };

export function AppSidebar() {
  const { state: sidebarState, setOpenMobile, isMobile } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state, currentUser, permissions } = useErp();

  const groups = useMemo(
    () => buildGroups(state, currentUser.id, permissions),
    [state, currentUser.id, permissions],
  );

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <FirmMark />
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {state.settings.firm.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/55">Büro paneli</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="h-7 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {g.items.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "h-9 rounded-lg text-sidebar-foreground/75 transition-all duration-150",
                          "hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.98]",
                          "data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_4px_14px_-6px_var(--sidebar-primary)]",
                        )}
                      >
                        <Link to={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {!!item.badge && (
                        <SidebarMenuBadge
                          className={
                            item.badgeTone === "red"
                              ? "rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white peer-data-[active=true]/menu-button:bg-white peer-data-[active=true]/menu-button:text-rose-600"
                              : "rounded-full bg-sidebar-accent px-1.5 text-[10px] font-semibold text-sidebar-foreground"
                          }
                        >
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 bg-sidebar p-2.5">
        {!collapsed ? (
          <div className="w-full overflow-hidden rounded-2xl bg-[#eaf6fc] px-2.5 py-1.5 shadow-sm ring-1 ring-white/10">
            <BrandImg
              variant="horizontal"
              className="mx-auto block h-7 w-full max-w-none object-contain"
              alt={BRAND.name}
            />
          </div>
        ) : (
          <div className="mx-auto overflow-hidden rounded-2xl bg-[#eaf6fc] p-1 shadow-sm ring-1 ring-white/10">
            <BrandImg variant="mark" className="block h-7 w-7 rounded-lg" alt={BRAND.name} />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function buildGroups(
  state: ReturnType<typeof useErp>["state"],
  userId: string,
  p: Permissions,
): Group[] {
  const t = today();
  const overdueInst = p.can("fees")
    ? allInstallments(state).filter((r) => r.status === "Gecikmiş").length
    : 0;
  const todayEvents = state.reminders.filter(
    (r) =>
      r.status === "Bekliyor" && r.date === t && (p.can("reminders") || r.assigneeId === userId),
  ).length;
  const brokenPromises = state.promises.filter((pr) => promiseStatus(pr) === "Gecikmiş").length;

  const groups: Group[] = [
    {
      label: "Genel",
      items: [
        { title: "Gösterge paneli", url: "/", icon: LayoutDashboard },
        {
          title: "Ajanda",
          url: "/takvim",
          icon: CalendarDays,
          badge: todayEvents,
          badgeTone: "blue",
        },
      ],
    },
    {
      label: "Büro",
      items: [
        ...(p.can("clients") ? [{ title: "Müvekkiller", url: "/muvekkiller", icon: Users }] : []),
        ...(p.can("cases") ? [{ title: "Dosyalar", url: "/dosyalar", icon: FolderKanban }] : []),
        ...(p.can("documents") ? [{ title: "Belgeler", url: "/belgeler", icon: FolderOpen }] : []),
      ],
    },
  ];

  const finance: Item[] = [];
  if (p.can("expenses") || p.can("expenses", "create"))
    finance.push({ title: "Masraflar", url: "/masraflar", icon: Receipt });
  if (p.can("fees"))
    finance.push({
      title: "Tahsilatlar",
      url: "/tahsilatlar",
      icon: Wallet,
      badge: overdueInst,
      badgeTone: "red",
    });
  if (p.can("ledger"))
    finance.push({ title: "Cari hesap", url: "/cari-hesap", icon: BookOpenCheck });
  if (p.can("accounts"))
    finance.push({ title: "Banka & Kasa", url: "/banka-kasa", icon: Landmark });
  if (finance.length) groups.push({ label: "Finans", items: finance });

  if (p.can("enforcements"))
    groups.push({
      label: "İcra",
      items: [
        {
          title: "İcra dosyaları",
          url: "/icra",
          icon: Gavel,
          badge: brokenPromises,
          badgeTone: "red",
        },
        { title: "Borçlular", url: "/borclular", icon: UserX },
      ],
    });

  const admin: Item[] = [];
  if (p.can("reports")) admin.push({ title: "Raporlar", url: "/raporlar", icon: BarChart3 });
  if (p.can("activity")) admin.push({ title: "Aktivite geçmişi", url: "/aktivite", icon: History });
  if (p.manageSettings) admin.push({ title: "Ayarlar", url: "/ayarlar", icon: Settings });
  if (admin.length) groups.push({ label: "Yönetim", items: admin });

  return groups.filter((g) => g.items.length > 0);
}
