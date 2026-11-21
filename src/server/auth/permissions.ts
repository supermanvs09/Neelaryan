/**
 * Permission catalogue. Every API route declares the permission it needs and the
 * server checks it against the signed-in user's role — hiding a menu item in the
 * UI is never the security boundary.
 */
export const PERMISSIONS = {
  "dashboard.view": "See the dashboard",
  "orders.view": "View orders",
  "orders.create": "Create orders at the counter (POS)",
  "orders.manage": "Change order status and cancel orders",
  "billing.manage": "Record payments and settle bills",
  "billing.refund": "Refund payments",
  "kitchen.view": "Open the kitchen workspace",
  "kitchen.update": "Update preparation status",
  "tables.view": "View tables",
  "tables.manage": "Add, edit and regenerate table QR codes",
  "menu.view": "View menu management",
  "menu.manage": "Edit menu items, prices, categories and add-ons",
  "inventory.view": "View inventory",
  "inventory.manage": "Edit inventory, record usage, wastage and counts",
  "purchases.manage": "Record purchases and manage suppliers",
  "finance.view": "View revenue, costs and profit & loss",
  "expenses.manage": "Record and void expenses",
  "reports.view": "View and export reports",
  "customers.view": "View customers",
  "customers.manage": "Edit customers and adjust points",
  "loyalty.manage": "Configure loyalty and rewards",
  "notifications.manage": "Manage templates, campaigns and birthday messages",
  "staff.manage": "Create staff accounts and edit role permissions",
  "settings.manage": "Change business settings",
  "audit.view": "View the audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const isPermission = (p: string): p is Permission => p in PERMISSIONS;

export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Orders & service", perms: ["dashboard.view", "orders.view", "orders.create", "orders.manage", "billing.manage", "billing.refund", "tables.view", "tables.manage"] },
  { label: "Kitchen", perms: ["kitchen.view", "kitchen.update"] },
  { label: "Menu & stock", perms: ["menu.view", "menu.manage", "inventory.view", "inventory.manage", "purchases.manage"] },
  { label: "Money", perms: ["finance.view", "expenses.manage", "reports.view"] },
  { label: "Customers", perms: ["customers.view", "customers.manage", "loyalty.manage", "notifications.manage"] },
  { label: "Administration", perms: ["staff.manage", "settings.manage", "audit.view"] },
];

export const SUPER_ADMIN = "super_admin";

export const DEFAULT_ROLES: { key: string; name: string; description: string; permissions: Permission[]; is_system: boolean }[] = [
  { key: SUPER_ADMIN, name: "Super Admin", description: "Full access, including staff accounts, permissions and business settings.", permissions: ALL_PERMISSIONS, is_system: true },
  {
    key: "manager",
    name: "Manager",
    description: "Runs daily operations: orders, menu, stock, customers and money.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "staff.manage" && p !== "settings.manage"),
    is_system: false,
  },
  {
    key: "staff",
    name: "Staff",
    description: "Service and counter: orders, billing, tables and customer help.",
    permissions: ["dashboard.view", "orders.view", "orders.create", "orders.manage", "billing.manage", "tables.view", "kitchen.view", "kitchen.update", "menu.view", "customers.view"],
    is_system: false,
  },
  {
    key: "kitchen",
    name: "Kitchen Staff",
    description: "Kitchen workspace only: incoming orders and preparation status.",
    permissions: ["kitchen.view", "kitchen.update"],
    is_system: false,
  },
];
