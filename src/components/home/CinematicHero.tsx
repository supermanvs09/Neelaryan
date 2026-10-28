"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { BowlScene } from "../food/BowlScene";
import { GlassScene } from "../food/GlassScene";
import { PIECES, SPRITES } from "@/data/sprites";
import type { IngredientId } from "@/data/builders";

const HERO_BOWL: IngredientId[] = ["regular-oats", "banana", "strawberry", "blueberry", "almonds", "chia", "honey"];

/**
 * A layer placed at a depth inside the 3D stage. `z` > 0 comes toward the
 * viewer; out-of-focus layers get a blur, like a shallow depth of field.
 */
function Layer({ z, blur = 0, className, style, children }: { z: number; blur?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={className}
      style={{ transform: `translateZ(${z}px)`, filter: blur ? `blur(${blur}px)` : undefined, transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  );
}

function Floater({ src, className, delay = 0, spin = 0 }: { src: string; className?: string; delay?: number; spin?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
      initial={reduced ? false : { opacity: 0, y: 40, rotate: spin - 20 }}
      animate={reduced ? undefined : { opacity: 1, y: [0, -10, 0], rotate: [spin, spin + 6, spin] }}
      transition={{ opacity: { delay, duration: 0.8 }, y: { delay, duration: 6 + delay, repeat: Infinity, ease: "easeInOut" }, rotate: { delay, duration: 7 + delay, repeat: Infinity, ease: "easeInOut" } }}
    />
  );
}

const prop = (k: keyof typeof SPRITES.props) => SPRITES.props[k].src;
const piece = (id: string, v = 0) => PIECES[id]?.[v]?.src ?? "";

export function CinematicHero({ greeting, eyebrow }: { greeting: ReactNode; eyebrow: ReactNode }) {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 60, damping: 18, mass: 0.8 };
  const ry = useSpring(useTransform(px, [-1, 1], [-9, 9]), spring);
  const rx = useSpring(useTransform(py, [-1, 1], [7, -7]), spring);
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const tiltScroll = useTransform(scrollYProgress, [0, 1], [0, 16]);
  const rxTotal = useTransform([rx, tiltScroll], ([a, b]) => (a as number) + (b as number));
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0.2]);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    // phones: a slow cinematic drift instead of pointer tracking
    let raf = 0;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const drift = () => {
      const t = performance.now() / 1000;
      px.set(Math.sin(t * 0.35) * 0.55);
      py.set(Math.cos(t * 0.27) * 0.35);
      raf = requestAnimationFrame(drift);
    };
    if (coarse) raf = requestAnimationFrame(drift);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [px, py, reduced]);

  return (
    <section className="relative -mx-4 overflow-hidden md:-mx-8" aria-labelledby="hero-title">
      {/* warm light + leaf shadows behind everything */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_70%_45%,rgba(255,221,160,0.75),rgba(251,246,236,0)_70%)]" />
      <div aria-hidden className="absolute inset-0 animate-sway bg-[radial-gradient(ellipse_40%_30%_at_85%_10%,rgba(47,58,34,0.14),transparent_70%),radial-gradient(ellipse_30%_25%_at_10%_90%,rgba(47,58,34,0.1),transparent_70%)] blur-xl" />

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-2 px-4 pb-8 pt-2 md:px-8 lg:min-h-[640px] lg:grid-cols-[1fr_1.15fr] lg:gap-6 lg:pb-14">
        <div className="relative z-10 order-2 lg:order-1">
          <motion.div initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 id="hero-title" className="mt-4 font-display text-[clamp(44px,8.5vw,92px)] font-semibold leading-[0.95] tracking-[-0.01em] text-navy-900">
              Good food,
              <br />
              <span className="text-gold-gradient italic">brighter</span> days.
            </h1>
            <p className="mt-5 max-w-md text-[16.5px] leading-relaxed text-ink-soft md:text-[18px]">{greeting}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/menu" className="btn-primary h-14 px-7 text-[16px]">
                Order now <ArrowRight size={18} />
              </Link>
              <Link href="/build/banana-peanut-butter-oats" className="btn-ghost h-14 px-6 text-[16px]">
                <Sparkles size={17} className="text-gold-600" /> Build your bowl
              </Link>
            </div>
          </motion.div>
        </div>

        {/* the 3D stage */}
        <motion.div ref={stage} className="relative order-1 h-[min(118vw,520px)] [perspective:1100px] lg:order-2 lg:h-[600px]" style={{ y: lift, opacity: fade }}>
          <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={{ rotateX: rxTotal, rotateY: ry }}>
            {/* far: soft background produce, out of focus */}
            <Layer z={-260} blur={3.5} className="absolute inset-0">
              <Floater src={prop("pomegranate")} className="absolute left-[4%] top-[8%] w-[22%] opacity-90" delay={0.4} spin={-8} />
              <Floater src={prop("lime")} className="absolute right-[2%] top-[4%] w-[17%]" delay={0.7} spin={12} />

            </Layer>

            {/* mid: the milkshake standing behind the bowl */}
            <Layer z={-90} className="absolute right-[2%] top-[4%] w-[34%] lg:right-[4%]">
              <GlassScene ingredients={["regular-milk", "ice-regular", "icecream-scoop"]} flavour="#b8b0a6" garnish="oreo" label="Oreo Milkshake" />
            </Layer>

            {/* hero: the bowl builds itself */}
            <Layer z={0} className="absolute bottom-[4%] left-[7%] w-[86%] lg:left-[11%] lg:w-[78%]">
              <BowlScene ingredients={HERO_BOWL} priority introDelay={0.9} label="A NEELARYAN oats bowl with banana, strawberries, blueberries, almonds, chia seeds and honey" />
            </Layer>

            {/* near: scattered produce on the counter, slightly soft */}
            <Layer z={120} blur={1.2} className="pointer-events-none absolute inset-0">
              <Floater src={piece("kiwi", 1)} className="absolute bottom-[2%] left-[1%] w-[16%]" delay={1.1} spin={-14} />
              <Floater src={prop("apple")} className="absolute bottom-[2%] right-[0%] w-[18%]" delay={1.3} spin={6} />
            </Layer>

            {/* nearest: a couple of berries drifting past the lens */}
            <Layer z={260} blur={4} className="pointer-events-none absolute inset-0">
              <Floater src={piece("strawberry", 1)} className="absolute left-[10%] top-[18%] w-[11%]" delay={1.6} spin={20} />
              <Floater src={piece("blueberry", 2)} className="absolute right-[12%] top-[48%] w-[7%]" delay={1.9} />
            </Layer>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
