"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useApp, cartTotals } from "@/store/app";
import { useUI } from "@/store/ui";
import { useAppHydrated } from "@/lib/hooks";
import { clsx } from "@/lib/clsx";
import { NAV, isActivePath } from "./nav";

/** Mobile-only: bottom navigation + a sticky "view cart" bar when the cart has items. */
export function BottomNav() {
  const pathname = usePathname();
  const hydrated = useAppHydrated();
  const cart = useApp((s) => s.cart);
  const openCart = useUI((s) => s.openCart);
  const { count, total } = cartTotals(hydrated ? cart : [], null);
  // focused flows (builder, checkout) have their own sticky action bar
  if (pathname.startsWith("/staff") || pathname.startsWith("/checkout") || pathname.startsWith("/build")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <AnimatePresence>
        {count > 0 && (
          <motion.div className="px-3 pb-2" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <button onClick={openCart} data-cart-target className="flex h-14 w-full items-center gap-3 rounded-2xl bg-navy-800 px-4 text-left text-ivory shadow-lift active:scale-[0.99]">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-400 text-navy-900">
                <ShoppingBag size={17} />
              </span>
              <span className="flex-1">
                <span className="block text-[13px] text-gold-200">
                  {count} item{count === 1 ? "" : "s"}
                </span>
                <span className="block text-[16px] font-bold">₹{total.toLocaleString("en-IN")} <span className="text-[12px] font-medium text-ivory/70">incl. GST</span></span>
              </span>
              <span className="flex items-center gap-1 text-[15px] font-semibold">
                View cart <ArrowRight size={17} />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <nav aria-label="Main" className="border-t border-sand-400/60 bg-ivory/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = isActivePath(pathname, n.href);
            const Icon = n.icon;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={active ? "page" : undefined} className={clsx("relative flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-navy-900" : "text-ink-muted")}>
                  {active && <motion.span layoutId="bn-dot" className="absolute top-1.5 h-1 w-6 rounded-full bg-gold-500" />}
                  <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
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
