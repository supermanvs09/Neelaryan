"use client";

import type { Diet } from "@/data/menu";
import { clsx } from "@/lib/clsx";

/** Indian food-type mark: green square (veg), brown (non-veg), amber (egg). */
export function DietMark({ diet, className }: { diet: Diet; className?: string }) {
  const color = diet === "veg" ? "border-veg text-veg" : diet === "egg" ? "border-egg text-egg" : "border-nonveg text-nonveg";
  const label = diet === "veg" ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian";
  return (
    <span role="img" aria-label={label} title={label} className={clsx("inline-grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-[#fff]", color, className)}>
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
