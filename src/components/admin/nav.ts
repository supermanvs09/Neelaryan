import {
  LayoutDashboard,
  ReceiptText,
  ChefHat,
  QrCode,
  BookOpen,
  Boxes,
  Truck,
  LineChart,
  FileBarChart,
  Users,
  Gift,
  Megaphone,
  ShieldCheck,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/server/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: Permission;
  exact?: boolean;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view", exact: true }] },
  {
    label: "Service",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ReceiptText, perm: "orders.view" },
      { href: "/admin/kitchen", label: "Kitchen", icon: ChefHat, perm: "kitchen.view" },
      { href: "/admin/tables", label: "Tables & QR codes", icon: QrCode, perm: "tables.view" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/menu", label: "Menu", icon: BookOpen, perm: "menu.view" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, perm: "inventory.view" },
      { href: "/admin/purchases", label: "Purchases & suppliers", icon: Truck, perm: "purchases.manage" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/admin/finance", label: "Finance & P&L", icon: LineChart, perm: "finance.view" },
      { href: "/admin/reports", label: "Reports", icon: FileBarChart, perm: "reports.view" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, perm: "customers.view" },
      { href: "/admin/loyalty", label: "Loyalty & rewards", icon: Gift, perm: "loyalty.manage" },
      { href: "/admin/notifications", label: "Notifications", icon: Megaphone, perm: "notifications.manage" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/staff", label: "Staff & permissions", icon: ShieldCheck, perm: "staff.manage" },
      { href: "/admin/audit", label: "Audit log", icon: History, perm: "audit.view" },
      { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    ],
  },
];

/** Where a user lands after sign-in: the first module they can use. */
export function homeFor(perms: string[]) {
  for (const g of NAV_GROUPS) for (const i of g.items) if (perms.includes(i.perm)) return i.href;
  return "/admin/account";
}
