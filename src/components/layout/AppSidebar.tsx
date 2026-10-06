import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CalendarClock,
  FolderKanban,
  FolderOpen,
  Gavel,
  History,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  UserX,
  Users,
  Wallet,
  BookOpenCheck,
  type LucideIcon,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useErp } from "@/lib/erp-store";
import { allInstallments, promiseStatus } from "@/lib/finance";
import { today } from "@/lib/format";
import { Avatar } from "@/components/app/bits";
import type { Permissions } from "@/lib/erp-types";

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
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:px-0"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#d4b483] to-[#a67c42] text-[#0c1c3f] shadow-[0_6px_18px_-6px_rgba(201,166,107,0.6)]">
            <Scale className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {state.settings.firm.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/55">Lex Yönetim</span>
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
                        className="h-9 rounded-lg text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.98] data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_4px_14px_-6px_var(--sidebar-primary)]"
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

      <SidebarFooter className="border-t border-sidebar-border/60">
        <Link
          to="/ayarlar"
          search={{ sekme: "hesabim" }}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:px-0"
        >
          <Avatar name={currentUser.name} size="sm" className="ring-2 ring-sidebar-primary/30" />
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-xs font-medium text-sidebar-foreground">
                {currentUser.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/55">
                {currentUser.title ?? currentUser.role}
              </span>
            </div>
          )}
        </Link>
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
  const overdueInst = p.viewFinance
    ? allInstallments(state).filter((r) => r.status === "Gecikmiş").length
    : 0;
  const todayEvents = state.reminders.filter(
    (r) => r.status === "Bekliyor" && r.date === t && (p.viewFinance || r.assigneeId === userId),
  ).length;
  const unreadMsg = new Set(state.messages.filter((m) => !m.readByFirm).map((m) => m.clientId))
    .size;
  const brokenPromises = state.promises.filter((pr) => promiseStatus(pr) === "Gecikmiş").length;
  const pendingDocs = state.docRequests.filter((r) => r.status === "Yüklendi").length;

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
        {
          title: "Mesajlar",
          url: "/mesajlar",
          icon: MessagesSquare,
          badge: unreadMsg,
          badgeTone: "red",
        },
      ],
    },
    {
      label: "Büro",
      items: [
        { title: "Müvekkiller", url: "/muvekkiller", icon: Users },
        { title: "Dosyalar", url: "/dosyalar", icon: FolderKanban },
        {
          title: "Belgeler",
          url: "/belgeler",
          icon: FolderOpen,
          badge: pendingDocs,
          badgeTone: "blue",
        },
      ],
    },
  ];

  const finance: Item[] = [{ title: "Masraflar", url: "/masraflar", icon: Receipt }];
  if (p.viewFinance) {
    finance.push(
      { title: "Masraf avansları", url: "/avanslar", icon: PiggyBank },
      { title: "Tahsilatlar", url: "/tahsilatlar", icon: Wallet },
      {
        title: "Taksitler",
        url: "/taksitler",
        icon: CalendarClock,
        badge: overdueInst,
        badgeTone: "red",
      },
      { title: "Cari hesap", url: "/cari-hesap", icon: BookOpenCheck },
      { title: "Banka & Kasa", url: "/banka-kasa", icon: Landmark },
    );
  }
  groups.push({ label: "Finans", items: finance });

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
  if (p.viewReports) admin.push({ title: "Raporlar", url: "/raporlar", icon: BarChart3 });
  if (p.viewActivity) admin.push({ title: "Aktivite geçmişi", url: "/aktivite", icon: History });
  if (p.manageSettings) admin.push({ title: "Ayarlar", url: "/ayarlar", icon: Settings });
  if (admin.length) groups.push({ label: "Yönetim", items: admin });

  return groups;
}
