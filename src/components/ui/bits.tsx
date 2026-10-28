"use client";

import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Diet } from "@/data/menu";
import { clsx } from "@/lib/clsx";

/** Indian food-type mark: green square (veg), brown (non-veg), amber (egg). */
export function DietMark({ diet, className }: { diet: Diet; className?: string }) {
  const color = diet === "veg" ? "border-veg text-veg" : diet === "egg" ? "border-egg text-egg" : "border-nonveg text-nonveg";
  const label = diet === "veg" ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian";
  return (
    <span role="img" aria-label={label} title={label} className={clsx("inline-grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-white", color, className)}>
      {diet === "nonveg" ? (
        <svg viewBox="0 0 10 10" className="h-[7px] w-[7px]" aria-hidden>
          <path d="M5 1 L9 9 L1 9 Z" fill="currentColor" />
        </svg>
      ) : (
        <span className="h-[7px] w-[7px] rounded-full bg-current" />
      )}
    </span>
  );
}

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 20,
  size = "md",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  label: string;
}) {
  const btn = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div className="inline-flex items-center rounded-full border border-sand-400 bg-white/80 p-0.5" role="group" aria-label={label}>
      <button type="button" className={clsx(btn, "grid place-items-center rounded-full text-navy-800 hover:bg-cream disabled:opacity-40")} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Decrease ${label}`}>
        <Minus size={16} />
      </button>
      <span className="relative w-7 overflow-hidden text-center text-[15px] font-bold tabular-nums text-navy-900" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} className="block" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.18 }}>
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" className={clsx(btn, "grid place-items-center rounded-full text-navy-800 hover:bg-cream disabled:opacity-40")} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`Increase ${label}`}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Animated rupee amount that rolls when it changes. */
export function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx("relative inline-flex overflow-hidden tabular-nums", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={value} initial={{ y: "70%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-70%", opacity: 0 }} transition={{ duration: 0.22 }}>
          ₹{value.toLocaleString("en-IN")}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
