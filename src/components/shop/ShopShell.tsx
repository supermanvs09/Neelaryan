"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Gift, Home, Languages, QrCode, ReceiptText, ShoppingBag, UserRound, UtensilsCrossed } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeSwitch } from "@/components/theme";
import { useMenu } from "@/lib/shop/menu";
import { priceCart, totalsFor, useShop, useShopHydrated } from "@/lib/shop/store";
import { useAccount } from "@/lib/shop/account";
import { I18nProvider, LANGS, useI18n, type MessageKey } from "@/lib/shop/i18n";
import { CartSheet, useCartSheet } from "./CartSheet";
import { ItemSheet } from "./ItemSheet";
import { ContextSheet, useContextSheet } from "./ContextSheet";
import { CallStaff } from "./CallStaff";
import { ToastHost, rupee } from "./ui";
import { clsx } from "@/lib/clsx";

const NAV: { href: string; key: MessageKey; icon: typeof Home }[] = [
  { href: "/", key: "nav.home", icon: Home },
  { href: "/menu", key: "nav.menu", icon: UtensilsCrossed },
  { href: "/orders", key: "nav.orders", icon: ReceiptText },
  { href: "/rewards", key: "nav.rewards", icon: Gift },
  { href: "/account", key: "nav.account", icon: UserRound },
];
const active = (p: string, h: string) => (h === "/" ? p === "/" : p.startsWith(h));

export function ShopShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <Shell>{children}</Shell>
    </I18nProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useShopHydrated();
  const load = useMenu((s) => s.load);
  const refreshAccount = useAccount((s) => s.refresh);

  useEffect(() => {
    useShop.persist.rehydrate();
    load();
    refreshAccount();
    // installable app + push: register the service worker (production builds only)
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
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
      <a href="#main" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-[90] focus-visible:rounded-full focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-primary-fg">
        Skip to content
      </a>
      <Header hydrated={hydrated} />
      <ClosedBanner />
      <main id="main" className={clsx("mx-auto w-full max-w-[1200px] px-4 pt-3 md:px-8", focused ? "pb-10" : "pb-[calc(env(safe-area-inset-bottom)+9rem)] md:pb-16")}>
        {children}
      </main>
      {!focused && <BottomBar hydrated={hydrated} />}
      {hydrated && !focused && <CallStaff />}
      <CartSheet />
      <ItemSheet />
      <ContextSheet />
      <ToastHost />
    </>
  );
}

export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <label className={clsx("relative inline-flex items-center", compact ? "" : "gap-2")}>
      <Languages size={16} className={clsx("text-muted", compact && "pointer-events-none absolute left-2.5")} aria-hidden />
      {!compact && <span className="text-[14px] font-semibold">{t("lang.label")}</span>}
      <select
        aria-label={t("lang.label")}
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
        className={clsx("h-10 rounded-lg border border-line bg-surface text-[13.5px] font-semibold", compact ? "w-[44px] appearance-none pl-8 pr-1 text-transparent sm:w-auto sm:pr-3 sm:text-fg" : "px-3")}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="text-fg">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ContextChip({ hydrated }: { hydrated: boolean }) {
  const { t } = useI18n();
  const mode = useShop((s) => s.mode);
  const table = useShop((s) => s.table);
  const open = useContextSheet((s) => s.set);
  if (!hydrated) return null;
  return (
    <button type="button" onClick={() => open(true)} className="inline-flex h-10 max-w-[42vw] items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-semibold text-fg hover:border-accent sm:max-w-none">
      {mode === "dine_in" && table ? (
        <>
          <QrCode size={15} aria-hidden /> <span className="truncate">{t("ctx.table", { table: table.label })}</span>
        </>
      ) : mode === "takeaway" ? (
        <>
          <ShoppingBag size={15} aria-hidden /> <span className="truncate">{t("ctx.takeaway")}</span>
        </>
      ) : (
        <>
          <UtensilsCrossed size={15} aria-hidden /> <span className="truncate">{t("ctx.pick")}</span>
        </>
      )}
    </button>
  );
}

function Header({ hydrated }: { hydrated: boolean }) {
  const { t } = useI18n();
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
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-4 md:h-[72px] md:px-8">
        <Link href="/" className="shrink-0 rounded-lg" aria-label={`${menu?.business.name ?? "NEELARYAN Café"} — ${t("nav.home")}`}>
          <Wordmark compact name={(menu?.business.name ?? "NEELARYAN Café").toUpperCase()} />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.slice(1).map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(pathname, n.href) ? "page" : undefined} className={clsx("rounded-lg px-3.5 py-2 text-[15px] font-semibold transition-colors", active(pathname, n.href) ? "bg-primary-soft text-fg" : "text-muted hover:text-fg")}>
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ContextChip hydrated={hydrated} />
          <div className="hidden sm:block">
            <LanguageSwitch compact />
          </div>
          <div className="hidden lg:block">
            <ThemeSwitch compact />
          </div>
          <button type="button" onClick={() => openCart(true)} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-card hover:bg-primary-hover" aria-label={`${t("cart.title")}, ${count}`}>
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
  const { t } = useI18n();
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
          <button type="button" onClick={() => openCart(true)} className="flex h-14 w-full items-center gap-3 rounded-full bg-primary pl-2.5 pr-5 text-left text-primary-fg shadow-lift">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-fg">
              <ShoppingBag size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-[12.5px] opacity-85">{count === 1 ? t("cart.item") : t("cart.items", { n: count })}</span>
              <span className="num block text-[16px] font-bold">
                {rupee(total)} <span className="text-[12px] font-medium opacity-75">{t("cart.inclGst")}</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-[15px] font-semibold">
              {t("cart.view")} <ArrowRight size={17} />
            </span>
          </button>
        </div>
      )}
      <nav aria-label="Main" className="border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const on = active(pathname, n.href);
            const Icon = n.icon;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={clsx("relative flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", on ? "text-primary" : "text-muted")}>
                  {on && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-accent" aria-hidden />}
                  <Icon size={21} strokeWidth={on ? 2.2 : 1.7} aria-hidden />
                  {t(n.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
