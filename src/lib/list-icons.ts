import {
  Banknote,
  Briefcase,
  Building,
  Building2,
  Car,
  Factory,
  Flag,
  Folder,
  Gavel,
  Hammer,
  HeartPulse,
  Home,
  Landmark,
  Scale,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Şirket listeleri için seçilebilen ikonlar (adı veritabanında saklanır) */
export const LIST_ICONS: Record<string, LucideIcon> = {
  building: Building,
  building2: Building2,
  briefcase: Briefcase,
  landmark: Landmark,
  factory: Factory,
  store: Store,
  truck: Truck,
  car: Car,
  home: Home,
  cart: ShoppingCart,
  banknote: Banknote,
  scale: Scale,
  gavel: Gavel,
  hammer: Hammer,
  wrench: Wrench,
  health: HeartPulse,
  users: Users,
  folder: Folder,
  star: Star,
  flag: Flag,
};

export const DEFAULT_LIST_ICON = "building";

export const listIcon = (name?: string): LucideIcon => LIST_ICONS[name ?? ""] ?? Building;
