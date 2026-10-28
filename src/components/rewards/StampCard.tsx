"use client";

import { motion, useReducedMotion } from "motion/react";
import { Gift } from "lucide-react";
import { LOYALTY_TARGET } from "@/data/config";
import { clsx } from "@/lib/clsx";

/**
 * Gold stamp coins that flip over in 3D as they're earned (CSS 3D:
 * preserve-3d + backface-visibility). The last slot is the reward.
 */
export function StampCard({ current, available, compact = false, tone = "light" }: { current: number; available: number; compact?: boolean; tone?: "light" | "dark" }) {
  const reduced = useReducedMotion();
  const slots = Array.from({ length: LOYALTY_TARGET }, (_, i) => i);
  return (
    <div
      className={clsx("grid gap-2.5 [perspective:600px]", compact ? "grid-cols-10" : "grid-cols-5 sm:grid-cols-10")}
      role="img"
      aria-label={`${current} of ${LOYALTY_TARGET} stamps collected${available ? `, ${available} reward${available > 1 ? "s" : ""} ready` : ""}`}
    >
      {slots.map((i) => {
        const earned = i < current;
        const last = i === LOYALTY_TARGET - 1;
        return (
          <motion.div
            key={i}
            className="relative aspect-square [transform-style:preserve-3d]"
            initial={false}
            animate={{ rotateY: earned ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 14, delay: i * 0.08 }}
          >
            <span
              className={clsx(
                "absolute inset-0 grid place-items-center rounded-full border-2 border-dashed [backface-visibility:hidden]",
                tone === "dark" ? "border-gold-400/50 bg-ivory/5 text-gold-300" : "border-gold-500/60 bg-white/60 text-gold-600",
              )}
            >
              {last ? <Gift size={compact ? 13 : 18} /> : <span className="text-[11px] font-bold opacity-75">{i + 1}</span>}
            </span>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fbe9b6,#d9b86a_45%,#a8812f)] shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),0_3px_8px_-2px_rgba(168,129,47,0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="font-display text-[clamp(12px,3.4vw,20px)] font-semibold italic text-navy-900">N</span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
