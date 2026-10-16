import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  FolderKanban,
  FolderOpen,
  Gavel,
  History,
  Landmark,
  LayoutDashboard,
  Receipt,
  Scale,
  Search,
  Settings,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BrandImg, FirmMark } from "@/components/app/Brand";
import { BRAND } from "@/lib/brand";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useErp } from "@/lib/erp-store";
import { allInstallments, promiseStatus, seizureWarning } from "@/lib/finance";
import { listIcon } from "@/lib/list-icons";
import { today } from "@/lib/format";
import type { Permissions } from "@/lib/erp-types";
import { cn } from "@/lib/utils";

type Badge = { badge?: number; badgeTone?: "red" | "blue" };
type Leaf = { title: string; url: string; icon: LucideIcon } & Badge;
/** Ayarlar → Şirket listeleri: kendi içinde açılır, altında arama kutusu var */
type CompanyBranch = { id: string; title: string; icon: LucideIcon; lists: Leaf[] };
type Branch = {
  id: string;
  title: string;
  icon: LucideIcon;
  children: Array<Leaf | CompanyBranch>;
} & Badge;
type Item = Leaf | Branch;
type Group = { label: string; items: Item[] };

const isBranch = (i: Item): i is Branch => "children" in i;
const isCompanyBranch = (c: Leaf | CompanyBranch): c is CompanyBranch => "lists" in c;

const leavesOf = (i: Item): Leaf[] =>
  isBranch(i) ? i.children.flatMap((c) => (isCompanyBranch(c) ? c.lists : [c])) : [i];

const badgeClass = (tone?: "red" | "blue") =>
  tone === "red"
    ? "rounded-full bg-rose-500 px-1.5 text-[12px] font-semibold text-white peer-data-[active=true]/menu-button:bg-white peer-data-[active=true]/menu-button:text-rose-600 dark:text-rose-400"
    : "rounded-full bg-sidebar-accent px-1.5 text-[12px] font-semibold text-sidebar-foreground";

const buttonClass = cn(
  "h-9 rounded-lg text-sidebar-foreground/75 transition-all duration-150",
  "hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.98]",
  "data-[active=true]:bg-sidebar-primary data-[active=true]:font-medium data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-[0_4px_14px_-6px_var(--sidebar-primary)]",
);

/** Alt madde: üst maddelerden küçük, soluk; aktifken belirgin bir vurgu şeridiyle */
const subButtonClass = cn(
  "h-8 gap-2.5 rounded-md pl-2.5 pr-2 text-[13.5px] text-sidebar-foreground/65",
  "[&>svg]:!size-[15px] [&>svg]:!text-sidebar-foreground/50",
  "hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
  "data-[active=true]:bg-sidebar-primary/20 data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground",
  "data-[active=true]:shadow-[inset_2px_0_0_var(--sidebar-primary)] data-[active=true]:[&>svg]:!text-sidebar-primary",
);

export function AppSidebar() {
  const { state: sidebarState, setOpenMobile, isMobile } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { state, currentUser, permissions } = useErp();

  const groups = useMemo(
    () => buildGroups(state, currentUser.id, permissions),
    [state, currentUser.id, permissions],
  );

  // En uzun eşleşen adres aktif sayılır: /icra/borclu açıkken "Alacaklı olduğumuz" (/icra) yanmaz
  const activeUrl = useMemo(() => {
    const urls = groups.flatMap((g) => g.items.flatMap(leavesOf)).map((l) => l.url);
    return urls
      .filter((u) =>
        u === "/" ? pathname === "/" : pathname === u || pathname.startsWith(u + "/"),
      )
      .sort((a, b) => b.length - a.length)[0];
  }, [groups, pathname]);
  const isActive = (url: string) => url === activeUrl;

  // Açık / kapalı accordion durumu; sayfa bir bölümün içindeyse o bölüm kendiliğinden açılır
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!activeUrl) return;
    const next: Record<string, boolean> = {};
    for (const g of groups)
      for (const item of g.items) {
        if (!isBranch(item)) continue;
        if (leavesOf(item).some((l) => l.url === activeUrl)) {
          next[item.id] = true;
          for (const c of item.children)
            if (isCompanyBranch(c) && c.lists.some((l) => l.url === activeUrl)) next[c.id] = true;
        }
      }
    if (Object.keys(next).length) setOpen((o) => ({ ...o, ...next }));
  }, [activeUrl, groups]);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

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
              <span className="truncate text-[12.5px] text-sidebar-foreground/55">Büro paneli</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="h-7 text-[12px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                {g.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {g.items.map((item) => {
                  if (!isBranch(item)) {
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.url)}
                          tooltip={item.title}
                          className={buttonClass}
                        >
                          <Link to={item.url} onClick={closeMobile}>
                            <item.icon className="h-[18px] w-[18px] shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        {!!item.badge && (
                          <SidebarMenuBadge className={badgeClass(item.badgeTone)}>
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  }

                  const inside = leavesOf(item).some((l) => l.url === activeUrl);
                  const isOpen = !!open[item.id];
                  const firstUrl = leavesOf(item)[0]?.url ?? "/";
                  return (
                    <SidebarMenuItem key={item.id}>
                      <Collapsible open={isOpen && !collapsed} onOpenChange={() => toggle(item.id)}>
                        <SidebarMenuButton
                          isActive={collapsed && inside}
                          tooltip={item.title}
                          aria-expanded={isOpen}
                          onClick={() =>
                            collapsed ? void navigate({ to: firstUrl }) : toggle(item.id)
                          }
                          className={cn(
                            buttonClass,
                            !collapsed && inside && "text-sidebar-foreground",
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <ChevronRight
                            className={cn(
                              "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                              isOpen && "rotate-90",
                            )}
                          />
                        </SidebarMenuButton>
                        {!!item.badge && !isOpen && (
                          <SidebarMenuBadge className={badgeClass(item.badgeTone)}>
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                        <CollapsibleContent>
                          <SidebarMenuSub className="mb-1 ml-[18px] mr-0 mt-0.5 gap-0.5 border-l-2 border-sidebar-border/60 py-0.5 pl-2 pr-0">
                            {item.children.map((c) =>
                              isCompanyBranch(c) ? (
                                <CompanyListsBranch
                                  key={c.id}
                                  branch={c}
                                  open={!!open[c.id]}
                                  onToggle={() => toggle(c.id)}
                                  query={query}
                                  onQuery={setQuery}
                                  isActive={isActive}
                                  onNavigate={closeMobile}
                                />
                              ) : (
                                <SidebarMenuSubItem key={c.url}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isActive(c.url)}
                                    className={subButtonClass}
                                  >
                                    <Link to={c.url} onClick={closeMobile}>
                                      <c.icon />
                                      <span>{c.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ),
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
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

/** "Şirket listeleri": açılınca hemen altında arama kutusu, sonra listeler (her birinin kendi ikonu) */
function CompanyListsBranch({
  branch,
  open,
  onToggle,
  query,
  onQuery,
  isActive,
  onNavigate,
}: {
  branch: CompanyBranch;
  open: boolean;
  onToggle: () => void;
  query: string;
  onQuery: (q: string) => void;
  isActive: (url: string) => boolean;
  onNavigate: () => void;
}) {
  const { permissions } = useErp();
  const q = query.trim().toLocaleLowerCase("tr");
  const shown = q
    ? branch.lists.filter((l) => l.title.toLocaleLowerCase("tr").includes(q))
    : branch.lists;
  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={onToggle}>
        <SidebarMenuSubButton
          asChild
          isActive={!open && branch.lists.some((l) => isActive(l.url))}
          className={subButtonClass}
        >
          <button type="button" onClick={onToggle} aria-expanded={open} className="w-full">
            <branch.icon />
            <span>{branch.title}</span>
            <span className="ml-auto rounded-full bg-sidebar-accent/70 px-1.5 text-[11.5px] leading-5 text-sidebar-foreground/60">
              {branch.lists.length}
            </span>
            <ChevronRight
              className={cn("!size-3.5 transition-transform duration-200", open && "rotate-90")}
            />
          </button>
        </SidebarMenuSubButton>
        <CollapsibleContent>
          {/* Bir kademe daha içeride, kendi çizgisiyle: arama kutusu ve listeler */}
          <div className="ml-[13px] mt-1 border-l-2 border-sidebar-border/40 pl-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-sidebar-foreground/45" />
              <Input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Liste ara…"
                aria-label="Şirket listesi ara"
                className="h-7 rounded-md border-sidebar-border/60 bg-sidebar-accent/40 py-0 pl-7 pr-2 text-xs shadow-none placeholder:text-sidebar-foreground/40 md:text-xs text-sidebar-foreground"
              />
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5 pb-1">
              {shown.map((l) => (
                <li key={l.url}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(l.url)}
                    className={cn(subButtonClass, "h-[30px] text-[13px]")}
                  >
                    <Link to={l.url} onClick={onNavigate}>
                      <l.icon />
                      <span>{l.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </li>
              ))}
              {shown.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
                  {branch.lists.length === 0 ? (
                    permissions.settingsAccess.companies.create ? (
                      <Link to="/ayarlar" search={{ sekme: "sirketler" }} className="underline">
                        Henüz liste yok. Ayarlar'dan ekleyin
                      </Link>
                    ) : (
                      "Henüz liste yok"
                    )
                  ) : (
                    "Liste bulunamadı"
                  )}
                </li>
              )}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
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
  const seizureSoon = state.enforcements.filter((e) => seizureWarning(e, state.settings)).length;
  const unread = state.notifications.filter((n) => n.userId === userId && !n.read).length;

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
          title: "Bildirimler",
          url: "/bildirimler",
          icon: Bell,
          badge: unread,
          badgeTone: "red",
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
          id: "icra",
          title: "İcra",
          icon: Gavel,
          badge: brokenPromises + seizureSoon,
          badgeTone: "red",
          children: [
            { title: "Alacaklı olduğumuz", url: "/icra", icon: Gavel },
            { title: "Borçlu olduğumuz", url: "/icra/borclu", icon: Scale },
            {
              id: "sirket-listeleri",
              title: "Şirket listeleri",
              icon: Building2,
              // Ayarlar → Şirket listeleri; her listenin kendi ikonu var
              lists: state.settings.companyLists.map((l) => ({
                title: l.name,
                url: `/icra/liste/${l.id}`,
                icon: listIcon(l.icon),
              })),
            },
            { title: "Borçlular", url: "/borclular", icon: UserX },
          ],
        },
      ],
    });

  const admin: Item[] = [];
  if (p.can("reports")) admin.push({ title: "Raporlar", url: "/raporlar", icon: BarChart3 });
  if (p.can("activity")) admin.push({ title: "Aktivite geçmişi", url: "/aktivite", icon: History });
  if (p.canOpenSettings) admin.push({ title: "Ayarlar", url: "/ayarlar", icon: Settings });
  if (admin.length) groups.push({ label: "Yönetim", items: admin });

  return groups.filter((g) => g.items.length > 0);
}
