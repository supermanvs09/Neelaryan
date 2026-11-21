"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, KeyRound, LogOut, Menu, X, ExternalLink } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "./nav";
import { ThemeSwitch } from "@/components/theme";
import { ToastProvider } from "./ui";
import { apiFetch } from "@/lib/api-client";
import { clsx } from "@/lib/clsx";

export interface ShellUser {
  name: string;
  username: string;
  roleName: string;
  permissions: string[];
}

const UserCtx = createContext<ShellUser | null>(null);
/** Current user in admin client components (for showing/hiding actions; the server still enforces). */
export const useAdminUser = () => useContext(UserCtx)!;
export const useCan = () => {
  const u = useAdminUser();
  return (p: string | string[]) => (Array.isArray(p) ? p : [p]).some((x) => u.permissions.includes(x));
};

const isActive = (path: string, item: NavItem) => (item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/"));

async function signOut() {
  await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  window.location.assign("/login");
}

function NavList({ groups, path, collapsed, onNavigate }: { groups: typeof NAV_GROUPS; path: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Console" className="flex-1 overflow-y-auto px-2.5 py-3">
      {groups.map((g) => (
        <div key={g.label} className="mb-4">
          {!collapsed && <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ivory/45 dark:text-muted">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = isActive(path, i);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? i.label : undefined}
                    className={clsx(
                      "flex h-9 items-center gap-3 rounded-lg px-2.5 text-[14px] font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active ? "bg-french-blue/25 text-[#fff]" : "text-[#d6dbe4] hover:bg-white/[0.06] hover:text-[#fff]",
                    )}
                  >
                    <i.icon size={18} aria-hidden className={clsx("shrink-0", active ? "text-[#c9a469]" : "opacity-80")} />
                    {!collapsed && <span className="truncate">{i.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * One console for every role. The sidebar only lists modules the user may open
 * (Navy foundation in both themes); the server enforces the same permissions.
 */
export function AdminShell({ user, businessName, children }: { user: ShellUser; businessName: string; children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => user.permissions.includes(i.perm)) })).filter((g) => g.items.length);
  const kitchenOnly = groups.length === 1 && groups[0].items.length === 1 && groups[0].items[0].href === "/admin/kitchen";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nr-nav-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => setDrawer(false), [path]);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("nr-nav-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  const brand = (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#b58a45] font-display text-[19px] font-semibold italic text-[#23324c]">N</span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold text-[#fff]">{businessName}</span>
          <span className="block text-[11px] text-[#aeb6c4]">Console</span>
        </span>
      )}
    </div>
  );

  const userBox = (compact: boolean) => (
    <div className="border-t border-white/10 p-2.5">
      {!compact && (
        <div className="mb-2 px-2.5">
          <p className="truncate text-[13.5px] font-semibold text-[#fff]">{user.name}</p>
          <p className="truncate text-[12px] text-[#aeb6c4]">
            {user.roleName} · @{user.username}
          </p>
        </div>
      )}
      <div className={clsx("flex gap-1", compact && "flex-col")}>
        <Link href="/admin/account" title="My account" className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] text-[#d6dbe4] hover:bg-white/[0.06] hover:text-[#fff]">
          <KeyRound size={16} aria-hidden /> {!compact && "Account"}
        </Link>
        <button onClick={signOut} title="Sign out" className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] text-[#d6dbe4] hover:bg-white/[0.06] hover:text-[#fff]">
          <LogOut size={16} aria-hidden /> {!compact && "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <UserCtx.Provider value={user}>
      <ToastProvider>
        <div className="min-h-dvh bg-bg">
          {/* desktop / tablet sidebar */}
          {!kitchenOnly && (
            <aside className={clsx("fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#1b2740] md:flex dark:border-r dark:border-line dark:bg-[#141e31]", collapsed ? "w-[68px]" : "w-[248px]")}>
              {brand}
              <NavList groups={groups} path={path} collapsed={collapsed} />
              <button onClick={toggle} className="mx-2.5 mb-1 flex h-8 items-center justify-center gap-2 rounded-lg text-[12.5px] text-[#aeb6c4] hover:bg-white/[0.06] hover:text-[#fff]" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                {collapsed ? <ChevronsRight size={16} /> : <>
                  <ChevronsLeft size={16} /> Collapse
                </>}
              </button>
              {userBox(collapsed)}
            </aside>
          )}

          {/* mobile drawer */}
          {drawer && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/45" onClick={() => setDrawer(false)} aria-hidden />
              <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[#1b2740] dark:bg-[#141e31]" aria-label="Console menu">
                <div className="flex items-center justify-between pr-2">
                  {brand}
                  <button onClick={() => setDrawer(false)} className="grid h-9 w-9 place-items-center rounded-lg text-[#d6dbe4]" aria-label="Close menu">
                    <X size={18} />
                  </button>
                </div>
                <NavList groups={groups} path={path} collapsed={false} onNavigate={() => setDrawer(false)} />
                {userBox(false)}
              </aside>
            </div>
          )}

          <div className={clsx(!kitchenOnly && (collapsed ? "md:pl-[68px]" : "md:pl-[248px]"))}>
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur-sm md:px-6">
              {!kitchenOnly && (
                <button onClick={() => setDrawer(true)} className="grid h-9 w-9 place-items-center rounded-lg text-fg hover:bg-surface-2 md:hidden" aria-label="Open menu">
                  <Menu size={19} />
                </button>
              )}
              {kitchenOnly && <span className="text-[15px] font-bold text-fg">{businessName} · Kitchen</span>}
              <div className="ml-auto flex items-center gap-2">
                <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-fg sm:flex">
                  Customer site <ExternalLink size={13} aria-hidden />
                </Link>
                <ThemeSwitch compact />
                {kitchenOnly && (
                  <button onClick={signOut} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-fg">
                    <LogOut size={16} /> Sign out
                  </button>
                )}
              </div>
            </header>
            <main id="main" className="mx-auto w-full max-w-[1440px] px-3 py-5 md:px-6 md:py-6">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </UserCtx.Provider>
  );
}
