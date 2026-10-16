import {
  BarChart3,
  BookOpenCheck,
  Bell,
  CalendarDays,
  FolderKanban,
  FolderOpen,
  Gavel,
  History,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  Users,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permissions } from "@/lib/erp-types";

export type NavPage = {
  title: string;
  url: string;
  icon: LucideIcon;
  allow?: (p: Permissions) => boolean;
};

export const NAV_PAGES: NavPage[] = [
  { title: "Gösterge paneli", url: "/", icon: LayoutDashboard },
  { title: "Ajanda", url: "/takvim", icon: CalendarDays },
  { title: "Müvekkiller", url: "/muvekkiller", icon: Users, allow: (p) => p.can("clients") },
  { title: "Dosyalar", url: "/dosyalar", icon: FolderKanban, allow: (p) => p.can("cases") },
  { title: "Belgeler", url: "/belgeler", icon: FolderOpen, allow: (p) => p.can("documents") },
  {
    title: "Masraflar",
    url: "/masraflar",
    icon: Receipt,
    allow: (p) => p.can("expenses") || p.can("expenses", "create"),
  },
  { title: "Tahsilatlar", url: "/tahsilatlar", icon: Wallet, allow: (p) => p.can("fees") },
  { title: "Cari hesap", url: "/cari-hesap", icon: BookOpenCheck, allow: (p) => p.can("ledger") },
  { title: "Banka & Kasa", url: "/banka-kasa", icon: Landmark, allow: (p) => p.can("accounts") },
  {
    title: "Alacaklı olduğumuz dosyalar",
    url: "/icra",
    icon: Gavel,
    allow: (p) => p.can("enforcements"),
  },
  {
    title: "Borçlu olduğumuz dosyalar",
    url: "/icra/borclu",
    icon: Scale,
    allow: (p) => p.can("enforcements"),
  },
  { title: "Borçlular", url: "/borclular", icon: UserX, allow: (p) => p.can("enforcements") },
  { title: "Bildirimler", url: "/bildirimler", icon: Bell },
  { title: "Dikkat gerektirenler", url: "/uyarilar", icon: Bell },
  { title: "Raporlar", url: "/raporlar", icon: BarChart3, allow: (p) => p.can("reports") },
  { title: "Aktivite geçmişi", url: "/aktivite", icon: History, allow: (p) => p.can("activity") },
  { title: "Ayarlar", url: "/ayarlar", icon: Settings, allow: (p) => p.canOpenSettings },
];

export function pageTitle(pathname: string) {
  const exact = NAV_PAGES.find((p) => p.url === pathname);
  if (exact) return exact.title;
  const parent = [...NAV_PAGES]
    .filter((p) => p.url !== "/")
    .sort((a, b) => b.url.length - a.url.length)
    .find((p) => pathname.startsWith(p.url + "/"));
  return parent?.title ?? "Avukat Yönetim Paneli";
}
