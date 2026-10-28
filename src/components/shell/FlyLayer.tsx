"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useUI, type FlyEvent } from "@/store/ui";

/** Item-to-cart cue: a token arcs from the "Add" button into the cart icon. */
export function FlyLayer() {
  const fly = useUI((s) => s.fly);
  return (
    <div className="pointer-events-none fixed inset-0 z-[75]" aria-hidden>
      {fly.map((f) => (
        <Flyer key={f.id} f={f} />
      ))}
    </div>
  );
}

function Flyer({ f }: { f: FlyEvent }) {
  const land = useUI((s) => s.landFly);
  const reduced = useReducedMotion();
  const [to, setTo] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-target]")).filter((el) => el.offsetParent !== null);
    const el = targets[0];
    if (!el || reduced) {
      land(f.id);
      return;
    }
    const r = el.getBoundingClientRect();
    setTo({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [f.id, land, reduced]);

  if (!to) return null;
  const sx = f.from.left + f.from.width / 2;
  const sy = f.from.top + f.from.height / 2;
  const midY = Math.min(sy, to.y) - 140;
  return (
    <motion.span
      className="absolute left-0 top-0 h-9 w-9 rounded-full border-2 border-white shadow-lift"
      style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${f.color} 55%)` }}
      initial={{ x: sx - 18, y: sy - 18, scale: 1, opacity: 1 }}
      animate={{ x: [sx - 18, (sx + to.x) / 2 - 18, to.x - 18], y: [sy - 18, midY, to.y - 18], scale: [1, 1.15, 0.35], opacity: [1, 1, 0.6] }}
      transition={{ duration: 0.75, ease: [0.3, 0, 0.6, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={() => land(f.id)}
    />
  );
}
