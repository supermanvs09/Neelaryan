"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { QrCode, ShoppingBag, ArrowRight, UtensilsCrossed, Gift, MapPin } from "lucide-react";
import { Tilt } from "../ui/Tilt";
import { Wordmark } from "../brand/Wordmark";
import { BowlScene } from "../food/BowlScene";
import { ModePicker } from "../shell/ModePicker";
import { useApp } from "@/store/app";
import { clsx } from "@/lib/clsx";

/** First screen: Dine in (table QR) or Order online (takeaway / delivery). */
export function EntryChooser() {
  const reduced = useReducedMotion();
  const setMode = useApp((s) => s.setMode);
  const [tablePicker, setTablePicker] = useState(false);
  const [online, setOnline] = useState(false);

  const fade = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <section className="mx-auto grid max-w-[1180px] items-center gap-4 pt-1 md:gap-8 md:pt-4 lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[1fr_1fr] lg:gap-14">
      <div>
        <motion.div {...fade(0)} className="hidden text-[56px] md:block md:text-[72px]">
          <Wordmark animate />
        </motion.div>
        <motion.h1 {...fade(1)} className="font-display md:mt-6 text-[clamp(40px,7vw,64px)] font-semibold leading-[1] text-navy-900">
          Good food,
          <br /> brighter days.
        </motion.h1>
        <motion.p {...fade(2)} className="mt-3 max-w-md text-[16.5px] text-ink-soft">
          Dine in, take away or order online — always a good choice. How would you like to order today?
        </motion.p>

        <motion.div {...fade(3)} className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 [perspective:1000px]">
          <Tilt className="rounded-[26px]">
            <button
              onClick={() => setTablePicker(true)}
              className="group relative flex h-full min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-[26px] bg-gradient-to-br from-navy-700 to-navy-900 p-5 text-left text-ivory shadow-lift sm:min-h-[220px]"
            >
              <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl" />
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ivory/10 ring-1 ring-gold-400/50 [transform:translateZ(40px)]">
                <QrCode size={28} className="text-gold-300" />
              </span>
              <span className="[transform:translateZ(28px)]">
                <span className="block font-display text-[30px] font-semibold leading-none">Dine in</span>
                <span className="mt-1 block text-[13.5px] text-ivory/75">Scan the table QR or pick your table</span>
                <span className="mt-3 inline-grid h-9 w-9 place-items-center rounded-full bg-gold-400 text-navy-900 transition-transform group-hover:translate-x-1">
                  <ArrowRight size={18} />
                </span>
              </span>
            </button>
          </Tilt>
          <Tilt className="rounded-[26px]">
            <div className={clsx("relative flex h-full min-h-[190px] w-full flex-col justify-between overflow-hidden rounded-[26px] border border-gold-400/60 bg-gradient-to-br from-[#fff7e6] to-sand-200 p-5 text-navy-900 shadow-lift sm:min-h-[220px]")}>
              {!online ? (
                <button onClick={() => setOnline(true)} className="group absolute inset-0 flex flex-col justify-between p-5 text-left">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/70 ring-1 ring-gold-400/60 [transform:translateZ(40px)]">
                    <ShoppingBag size={26} className="text-gold-700" />
                  </span>
                  <span className="[transform:translateZ(28px)]">
                    <span className="block font-display text-[30px] font-semibold leading-none">Order online</span>
                    <span className="mt-1 block text-[13.5px] text-ink-soft">For takeaway or delivery</span>
                    <span className="mt-3 inline-grid h-9 w-9 place-items-center rounded-full bg-navy-800 text-ivory transition-transform group-hover:translate-x-1">
                      <ArrowRight size={18} />
                    </span>
                  </span>
                </button>
              ) : (
                <div className="flex h-full flex-col justify-center gap-2.5">
                  <p className="font-display text-[22px] font-semibold">Choose one</p>
                  <button className="btn-primary h-12" onClick={() => setMode("takeaway")}>
                    Takeaway
                  </button>
                  <button className="btn-ghost h-12" onClick={() => setMode("delivery")}>
                    Delivery
                  </button>
                </div>
              )}
            </div>
          </Tilt>
        </motion.div>

        <motion.nav {...fade(4)} aria-label="Explore" className="mt-6 grid grid-cols-3 gap-2 text-center text-[13px] font-semibold text-navy-800">
          {[
            { href: "/menu", label: "Our menu", icon: UtensilsCrossed },
            { href: "/rewards", label: "Rewards", icon: Gift },
            { href: "/profile#visit", label: "Find us", icon: MapPin },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 rounded-2xl py-3 hover:bg-white/60">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-gold-400/60 bg-white/70">
                <l.icon size={19} className="text-gold-700" />
              </span>
              {l.label}
            </Link>
          ))}
        </motion.nav>
        <p className="mt-4 text-center text-[12.5px] text-ink-muted lg:text-left">
          Team member? <Link href="/staff" className="font-semibold text-navy-800 underline-offset-2 hover:underline">Staff / Kitchen</Link>
        </p>
      </div>

      <motion.div {...fade(2)} className="relative order-first mx-auto w-full max-w-[min(72vw,320px)] md:max-w-[560px] lg:order-none">
        <div aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(255,221,160,0.8),rgba(255,221,160,0)_70%)]" />
        <BowlScene ingredients={["regular-oats", "banana", "strawberry", "blueberry", "pomegranate", "almonds", "honey"]} priority introDelay={0.6} label="A NEELARYAN oats bowl building itself" />
      </motion.div>
      <ModePicker open={tablePicker} onClose={() => setTablePicker(false)} />
    </section>
  );
}
