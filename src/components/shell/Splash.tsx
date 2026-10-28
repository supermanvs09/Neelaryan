"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";

const LETTERS = "Neelaryan".split("");

/**
 * Branded opening (≈2.6s, tap to skip): a gold swash draws itself, the
 * wordmark's letters swing up out of depth, the tagline settles and a light
 * shimmer passes across before the page is revealed.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onDone, reduced ? 900 : 2700);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-ivory"
      onClick={onDone}
      role="presentation"
      initial={{ opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.06, filter: "blur(6px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,224,160,0.7),rgba(251,246,236,0)_60%)]" />
      <div aria-hidden className="absolute -right-24 -top-24 h-[70vmin] w-[70vmin] animate-sway rounded-full bg-[radial-gradient(circle,rgba(47,58,34,0.16),rgba(47,58,34,0)_60%)] blur-2xl" />

      <div className="relative flex flex-col items-center [perspective:900px]">
        <h1 className="sr-only">NEELARYAN Café</h1>
        <div className="relative font-display text-[clamp(64px,17vw,148px)] font-semibold leading-none text-navy-900" aria-hidden>
          <span className="flex [transform-style:preserve-3d]">
            {LETTERS.map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block origin-bottom"
                initial={reduced ? { opacity: 0 } : { opacity: 0, rotateX: -88, y: 28, z: -120 }}
                animate={{ opacity: 1, rotateX: 0, y: 0, z: 0 }}
                transition={{ delay: reduced ? 0 : 0.55 + i * 0.06, duration: 0.8, ease: [0.2, 0.9, 0.25, 1] }}
              >
                {ch}
              </motion.span>
            ))}
          </span>
          <svg viewBox="0 0 400 60" className="absolute left-[-7%] top-[54%] h-[0.6em] w-[114%] overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="splash-gold" x1="0" x2="1">
                <stop offset="0" stopColor="#8a6a22" />
                <stop offset="0.4" stopColor="#d9b86a" />
                <stop offset="0.55" stopColor="#fbeab8" />
                <stop offset="0.75" stopColor="#c9a04a" />
                <stop offset="1" stopColor="#8a6a22" />
              </linearGradient>
            </defs>
            <motion.path
              d="M8 6 C 40 40, 90 52, 170 44 S 320 22, 396 30"
              fill="none"
              stroke="url(#splash-gold)"
              strokeWidth="5"
              strokeLinecap="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>
          {/* shimmer sweep */}
          {!reduced && (
            <motion.span
              className="pointer-events-none absolute inset-y-[-10%] w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-overlay"
              initial={{ x: "-120%" }}
              animate={{ x: "380%" }}
              transition={{ delay: 1.6, duration: 0.9, ease: "easeInOut" }}
            />
          )}
        </div>
        <motion.p
          className="mt-6 flex items-center gap-3 text-[11px] font-bold uppercase text-navy-800 md:text-[13px]"
          initial={{ opacity: 0, letterSpacing: "0.8em" }}
          animate={{ opacity: 1, letterSpacing: "0.42em" }}
          transition={{ delay: reduced ? 0 : 1.25, duration: 0.9, ease: "easeOut" }}
        >
          <span className="h-px w-8 bg-gold-500" />
          Crave the goodness
          <span className="h-px w-8 bg-gold-500" />
        </motion.p>
      </div>
      <motion.p
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] font-display text-[22px] italic text-ink-muted"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 1.7, duration: 0.6 }}
      >
        Good food, brighter days.
      </motion.p>
    </motion.div>
  );
}
