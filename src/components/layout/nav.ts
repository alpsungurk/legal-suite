import {
  BarChart3,
  BookOpenCheck,
  Bell,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  FolderOpen,
  Gavel,
  History,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  PiggyBank,
  Receipt,
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
  { title: "Mesajlar", url: "/mesajlar", icon: MessagesSquare },
  { title: "Müvekkiller", url: "/muvekkiller", icon: Users },
  { title: "Dosyalar", url: "/dosyalar", icon: FolderKanban },
  { title: "Belgeler", url: "/belgeler", icon: FolderOpen },
  { title: "Masraflar", url: "/masraflar", icon: Receipt },
  { title: "Masraf avansları", url: "/avanslar", icon: PiggyBank, allow: (p) => p.viewFinance },
  { title: "Tahsilatlar", url: "/tahsilatlar", icon: Wallet, allow: (p) => p.viewFinance },
  { title: "Taksitler", url: "/taksitler", icon: CalendarClock, allow: (p) => p.viewFinance },
  { title: "Cari hesap", url: "/cari-hesap", icon: BookOpenCheck, allow: (p) => p.viewFinance },
  { title: "Banka & Kasa", url: "/banka-kasa", icon: Landmark, allow: (p) => p.viewFinance },
  { title: "İcra dosyaları", url: "/icra", icon: Gavel },
  { title: "Borçlular", url: "/borclular", icon: UserX },
  { title: "Bildirimler", url: "/bildirimler", icon: Bell },
  { title: "Raporlar", url: "/raporlar", icon: BarChart3, allow: (p) => p.viewReports },
  { title: "Aktivite geçmişi", url: "/aktivite", icon: History, allow: (p) => p.viewActivity },
  { title: "Ayarlar", url: "/ayarlar", icon: Settings, allow: (p) => p.manageSettings },
];

export function pageTitle(pathname: string) {
  const exact = NAV_PAGES.find((p) => p.url === pathname);
  if (exact) return exact.title;
  const parent = [...NAV_PAGES]
    .filter((p) => p.url !== "/")
    .sort((a, b) => b.url.length - a.url.length)
    .find((p) => pathname.startsWith(p.url + "/"));
  return parent?.title ?? "Lex Yönetim";
}
