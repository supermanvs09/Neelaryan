"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { clsx } from "@/lib/clsx";

/**
 * CSS 3D tilt: the card leans toward the pointer and a soft specular glare
 * follows it. Children can float above the surface with `[transform:translateZ()]`.
 * Touch devices get a gentle press-in instead of tracking.
 */
export function Tilt({
  children,
  className,
  max = 9,
  glare = true,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
  as?: "div" | "li" | "article";
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), spring);
  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const glareBg = useTransform([gx, gy], ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,250,235,0.55), rgba(255,250,235,0) 55%)`);

  const Comp = motion[as];

  if (reduced) return <Comp className={className}>{children}</Comp>;

  return (
    <Comp
      ref={ref as never}
      className={clsx("group relative [transform-style:preserve-3d]", className)}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
      whileTap={{ scale: 0.985 }}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 mix-blend-soft-light transition-opacity duration-300 [@media(hover:hover)]:group-hover:opacity-100"
          style={{ background: glareBg }}
        />
      )}
    </Comp>
  );
}
