"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { ShoppingBag, ChevronDown } from "lucide-react";
import { Wordmark } from "../brand/Wordmark";
import { useApp, cartTotals } from "@/store/app";
import { useUI } from "@/store/ui";
import { useAppHydrated } from "@/lib/hooks";
import { clsx } from "@/lib/clsx";
import { NAV, isActivePath } from "./nav";
import { ModePicker, modeLabel } from "./ModePicker";

export function Header() {
  const pathname = usePathname();
  const hydrated = useAppHydrated();
  const cart = useApp((s) => s.cart);
  const mode = useApp((s) => s.mode);
  const table = useApp((s) => s.table);
  const openCart = useUI((s) => s.openCart);
  const pulse = useUI((s) => s.cartPulse);
  const [picker, setPicker] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const count = hydrated ? cartTotals(cart, null).count : 0;
  const controls = useAnimationControls();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (pulse) controls.start({ scale: [1, 1.22, 0.94, 1], rotate: [0, -8, 6, 0], transition: { duration: 0.5 } });
  }, [pulse, controls]);

  if (pathname.startsWith("/staff")) return null;

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300",
          scrolled ? "bg-ivory/85 shadow-[0_1px_0_rgba(185,164,124,0.35)] backdrop-blur-md" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-3 px-4 md:h-20 md:px-8">
          <Link href="/" className="shrink-0 rounded-lg text-[30px] md:text-[38px]" aria-label="NEELARYAN Café — home">
            <Wordmark tagline={false} />
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.slice(0, 4).map((n) => {
              const active = isActivePath(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx("relative rounded-full px-4 py-2 text-[15px] font-semibold transition-colors", active ? "text-navy-900" : "text-ink-soft hover:text-navy-900")}
                >
                  {active && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-gold-200/80" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {hydrated && (
              <button onClick={() => setPicker(true)} className="chip max-w-[46vw] border-sand-400 bg-white/70 text-navy-800 hover:border-gold-500">
                <span className="truncate">{modeLabel(mode, table)}</span>
                <ChevronDown size={15} className="shrink-0" />
              </button>
            )}
            <Link href="/profile" className="hidden h-11 items-center rounded-full px-3 text-[15px] font-semibold text-ink-soft hover:text-navy-900 md:flex">
              Profile
            </Link>
            <motion.button
              animate={controls}
              onClick={openCart}
              data-cart-target
              className="relative grid h-11 w-11 place-items-center rounded-full bg-navy-800 text-ivory shadow-lift hover:bg-navy-700"
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-gold-400 px-1 text-[12px] font-bold text-navy-900 ring-2 ring-ivory"
                >
                  {count}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </header>
      <ModePicker open={picker} onClose={() => setPicker(false)} />
    </>
  );
}
