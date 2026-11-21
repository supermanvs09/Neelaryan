"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Gift, Home, QrCode, ReceiptText, ShoppingBag, UserRound, UtensilsCrossed } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeSwitch } from "@/components/theme";
import { useMenu } from "@/lib/shop/menu";
import { priceCart, totalsFor, useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { CartSheet, useCartSheet } from "./CartSheet";
import { ItemSheet } from "./ItemSheet";
import { ContextSheet, useContextSheet } from "./ContextSheet";
import { ToastHost, rupee } from "./ui";
import { clsx } from "@/lib/clsx";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/orders", label: "Orders", icon: ReceiptText },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/account", label: "Account", icon: UserRound },
] as const;
const active = (p: string, h: string) => (h === "/" ? p === "/" : p.startsWith(h));

export function ShopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useShopHydrated();
  const load = useMenu((s) => s.load);
  const refreshAccount = useAccount((s) => s.refresh);

  useEffect(() => {
    useShop.persist.rehydrate();
    load();
    refreshAccount();
    // keep availability fresh while the page is open
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const t = setInterval(() => load(true), 120_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [load, refreshAccount]);

  const focused = pathname.startsWith("/checkout") || pathname.startsWith("/build");

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">
        Skip to content
      </a>
      <Header hydrated={hydrated} />
      <ClosedBanner />
      <main id="main" className={clsx("mx-auto w-full max-w-[1200px] px-4 pt-3 md:px-8", focused ? "pb-10" : "pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-16")}>
        {children}
      </main>
      {!focused && <BottomBar hydrated={hydrated} />}
      <CartSheet />
      <ItemSheet />
      <ContextSheet />
      <ToastHost />
    </>
  );
}

function ContextChip({ hydrated }: { hydrated: boolean }) {
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const open = useContextSheet((s) => s.set);
  if (!hydrated) return null;
  return (
    <button type="button" onClick={() => open(true)} className="inline-flex h-10 max-w-[44vw] items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13.5px] font-semibold hover:border-line-strong">
      {mode === "dine_in" && table ? (
        <>
          <QrCode size={15} aria-hidden /> <span className="truncate">Table {table.label}</span>
        </>
      ) : mode === "takeaway" ? (
        <>
          <ShoppingBag size={15} aria-hidden /> <span className="truncate">Takeaway</span>
        </>
      ) : (
        <span className="truncate">How are you ordering?</span>
      )}
    </button>
  );
}

function Header({ hydrated }: { hydrated: boolean }) {
  const pathname = usePathname();
  const menu = useMenu((s) => s.menu);
  const cart = useShop((s) => s.cart);
  const openCart = useCartSheet((s) => s.set);
  const count = hydrated ? priceCart(menu, cart).count : 0;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={clsx("sticky top-0 z-40 border-b bg-bg/95 transition-colors", scrolled ? "border-line" : "border-transparent")}>
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-3 px-4 md:h-[72px] md:px-8">
        <Link href="/" className="shrink-0 rounded-lg" aria-label={`${menu?.business.name ?? "NEELARYAN Café"} — home`}>
          <Wordmark compact name={(menu?.business.name ?? "NEELARYAN Café").toUpperCase()} />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(pathname, n.href) ? "page" : undefined} className={clsx("rounded-lg px-4 py-2 text-[15px] font-semibold transition-colors", active(pathname, n.href) ? "bg-primary-soft text-fg" : "text-muted hover:text-fg")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ContextChip hydrated={hydrated} />
          <div className="hidden lg:block">
            <ThemeSwitch compact />
          </div>
          <button type="button" onClick={() => openCart(true)} className="relative grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-fg hover:bg-primary-hover" aria-label={`Your order, ${count} item${count === 1 ? "" : "s"}`}>
            <ShoppingBag size={19} />
            {count > 0 && <span className="num absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1 text-[12px] font-bold text-accent-fg ring-2 ring-bg">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function ClosedBanner() {
  const ordering = useMenu((s) => s.menu?.ordering);
  if (!ordering || ordering.accepting_orders) return null;
  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-center text-[14px] font-semibold text-warning" role="status">
      {ordering.closed_message}
    </div>
  );
}

function BottomBar({ hydrated }: { hydrated: boolean }) {
  const pathname = usePathname();
  const menu = useMenu((s) => s.menu);
  const cart = useShop((s) => s.cart);
  const openCart = useCartSheet((s) => s.set);
  const { count, subtotal } = priceCart(menu, hydrated ? cart : []);
  const total = totalsFor(menu, subtotal, 0).total;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {count > 0 && (
        <div className="px-3 pb-2">
          <button type="button" onClick={() => openCart(true)} className="flex h-14 w-full items-center gap-3 rounded-xl bg-primary px-4 text-left text-primary-fg shadow-lift">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg">
              <ShoppingBag size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-[12.5px] opacity-85">
                {count} item{count === 1 ? "" : "s"}
              </span>
              <span className="num block text-[16px] font-bold">
                {rupee(total)} <span className="text-[12px] font-medium opacity-75">incl. GST</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-[15px] font-semibold">
              View order <ArrowRight size={17} />
            </span>
          </button>
        </div>
      )}
      <nav aria-label="Main" className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = active(pathname, n.href);
            const Icon = n.icon;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={clsx("flex h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-primary" : "text-muted")}>
                  <Icon size={21} strokeWidth={on ? 2.3 : 1.8} aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
