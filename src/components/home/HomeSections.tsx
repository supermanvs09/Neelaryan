"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { CATEGORIES, MENU } from "@/data/menu";
import { Tilt } from "../ui/Tilt";
import { FoodArt } from "../food/FoodArt";
import { BowlScene } from "../food/BowlScene";
import { GlassScene } from "../food/GlassScene";
import { ItemCard } from "../menu/ItemCard";
import { StampCard } from "../rewards/StampCard";
import { useApp } from "@/store/app";
import { useOrders } from "@/store/orders";
import { loyaltyFrom } from "@/lib/loyalty";
import { LOYALTY_REWARD } from "@/data/config";

const reveal = (reduced: boolean | null, i = 0) =>
  reduced ? {} : { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const } };

function SectionTitle({ eyebrow, title, href, cta }: { eyebrow: string; title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-1.5 font-display text-[34px] font-semibold leading-none text-navy-900 md:text-[44px]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="hidden shrink-0 items-center gap-1 text-[15px] font-semibold text-navy-800 hover:text-gold-700 sm:flex">
          {cta} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

export function CategoryRail() {
  const reduced = useReducedMotion();
  return (
    <section className="mt-6 md:mt-12" aria-labelledby="cat-title">
      <SectionTitle eyebrow="Our menu" title="What are you craving?" href="/menu" cta="Full menu" />
      <h2 id="cat-title" className="sr-only">
        Menu categories
      </h2>
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [perspective:1000px] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6">
        {CATEGORIES.map((c, i) => {
          const sample = MENU.find((m) => m.category === c.id)!;
          return (
            <motion.li key={c.id} className="w-[38vw] max-w-[180px] shrink-0 snap-start md:w-auto md:max-w-none" {...reveal(reduced, i)}>
              <Tilt className="rounded-3xl">
                <Link href={`/menu#${c.id}`} className="card flex flex-col items-center gap-2 px-3 pb-4 pt-3 text-center hover:shadow-lift">
                  <span className="grid aspect-square w-full place-items-center rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#fffaf0,#efe2c6)] [transform:translateZ(26px)]">
                    <FoodArt kind={c.art} tint={sample.tint} className="h-[78%] w-[78%]" />
                  </span>
                  <span className="text-[14px] font-semibold leading-tight text-navy-900">{c.short}</span>
                </Link>
              </Tilt>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

export function SignatureBuilders() {
  const reduced = useReducedMotion();
  return (
    <section className="mt-12 md:mt-20" aria-label="Signature builders">
      <SectionTitle eyebrow="Signature" title="Made exactly your way" />
      <div className="grid gap-4 md:grid-cols-2 [perspective:1200px]">
        <motion.div {...reveal(reduced, 0)}>
          <Tilt className="rounded-[32px]">
            <Link href="/build/banana-peanut-butter-oats" className="group relative grid min-h-[320px] grid-cols-[1fr_1.1fr] items-center overflow-hidden rounded-[32px] bg-gradient-to-br from-[#fff6e3] to-sand-200 p-6 shadow-lift md:min-h-[360px]">
              <div className="relative z-10 [transform:translateZ(30px)]">
                <p className="eyebrow">Build your own</p>
                <h3 className="mt-2 font-display text-[34px] font-semibold leading-[1] text-navy-900">Oats bowl</h3>
                <p className="mt-2 text-[14.5px] text-ink-soft">Base, fruits, toppings, protein — watch each one drop in.</p>
                <span className="btn-primary mt-5 h-11 group-hover:bg-navy-700">
                  Start building <ArrowRight size={16} />
                </span>
              </div>
              <div className="[transform:translateZ(60px)]">
                <BowlScene ingredients={["regular-oats", "kiwi", "mango", "granola", "peanut-butter", "chia"]} label="A custom oats bowl with kiwi, mango, granola, peanut butter and chia" />
              </div>
            </Link>
          </Tilt>
        </motion.div>
        <motion.div {...reveal(reduced, 1)}>
          <Tilt className="rounded-[32px]">
            <Link href="/build/oreo-milkshake" className="group relative grid min-h-[320px] grid-cols-[1fr_0.8fr] items-center overflow-hidden rounded-[32px] bg-gradient-to-br from-navy-700 to-navy-950 p-6 text-ivory shadow-lift md:min-h-[360px]">
              <span aria-hidden className="absolute -right-16 top-0 h-64 w-64 rounded-full bg-gold-400/25 blur-3xl" />
              <div className="relative z-10 [transform:translateZ(30px)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-300">Shake it your way</p>
                <h3 className="mt-2 font-display text-[34px] font-semibold leading-[1]">Milkshakes</h3>
                <p className="mt-2 text-[14.5px] text-ivory/75">Choose the milk, sweetness, toppings and a scoop on top.</p>
                <span className="btn-gold mt-5 h-11">
                  Customise <ArrowRight size={16} />
                </span>
              </div>
              <div className="relative [transform:translateZ(60px)]">
                <GlassScene ingredients={["regular-milk", "ice-regular", "icecream-scoop", "choco-chips"]} flavour="#6b3f25" garnish="choco-drizzle" label="A chocolate milkshake with an ice cream scoop" />
              </div>
            </Link>
          </Tilt>
        </motion.div>
      </div>
    </section>
  );
}


export function Favourites() {
  const picks = MENU.filter((m) => m.tags.includes("bestseller") || m.tags.includes("recommended")).slice(0, 8);
  return (
    <section className="mt-12 md:mt-20" aria-labelledby="fav-title">
      <SectionTitle eyebrow="Loved here" title="Café favourites" href="/menu" cta="See everything" />
      <h2 id="fav-title" className="sr-only">
        Café favourites
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {picks.map((m) => (
          <ItemCard key={m.id} item={m} />
        ))}
      </div>
    </section>
  );
}

export function LoyaltyTeaser() {
  const reduced = useReducedMotion();
  const orders = useOrders((s) => s.orders);
  const redeemed = useApp((s) => s.rewardsRedeemed);
  const l = loyaltyFrom(orders, redeemed);
  return (
    <motion.section {...reveal(reduced)} className="mt-12 overflow-hidden rounded-[32px] bg-gradient-to-br from-navy-800 to-navy-950 p-6 text-ivory shadow-lift md:mt-20 md:p-10" aria-labelledby="loyal-title">
      <div className="grid items-center gap-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold-300">Your NEELARYAN journey</p>
          <h2 id="loyal-title" className="mt-2 font-display text-[36px] font-semibold leading-[1.02] md:text-[46px]">
            Ten visits, <span className="italic text-gold-300">one treat on us.</span>
          </h2>
          <p className="mt-3 max-w-md text-[15px] text-ivory/75">
            Earn a stamp with every completed, paid order (one a day). Collect 10 for {LOYALTY_REWARD}.
          </p>
          <Link href="/rewards" className="btn-gold mt-5 h-12">
            <Sparkles size={16} /> View rewards
          </Link>
        </div>
        <div className="rounded-3xl bg-ivory/5 p-5 ring-1 ring-gold-400/30">
          <p className="mb-3 text-[14px] text-ivory/80">
            {l.available > 0 ? <b className="text-gold-300">A reward is ready to redeem!</b> : <>{l.current} / 10 stamps · {l.toNext} more for a free drink</>}
          </p>
          <StampCard current={l.current} available={l.available} tone="dark" />
        </div>
      </div>
    </motion.section>
  );
}
