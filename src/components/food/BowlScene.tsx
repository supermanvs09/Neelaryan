"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { IngredientId } from "@/data/builders";
import { PIECES, SPRITES, type PieceSprite } from "@/data/sprites";
import { BOWL_DIST, BOWL_PX, projectToBowl, unitsAcross } from "@/lib/spriteCamera";
import { clsx } from "@/lib/clsx";
import { hash, rng } from "@/lib/random";

/**
 * Layered HTML/CSS bowl: back of the bowl → oats bed → ingredient cut-outs →
 * drizzles → front rim. Pieces are placed with the same camera maths the
 * sprites were rendered with, so they sit on the oats in true perspective and
 * fall *into* the bowl behind its front rim.
 */

const BASES: IngredientId[] = ["regular-oats", "oats-milk", "extra-oats"];

type Layout = "sector" | "scatter" | "center";
interface Recipe {
  /** sprite ids (manifest keys) and how many of each */
  parts: { sprite: string; kind?: number; count: number }[];
  layout: Layout;
  scale?: [number, number];
}

const PIECE_RECIPES: Partial<Record<IngredientId, Recipe>> = {
  banana: { parts: [{ sprite: "banana", count: 10 }], layout: "sector" },
  strawberry: { parts: [{ sprite: "strawberry", count: 8 }], layout: "sector" },
  blueberry: { parts: [{ sprite: "blueberry", count: 18 }], layout: "sector" },
  kiwi: { parts: [{ sprite: "kiwi", count: 7 }], layout: "sector" },
  apple: { parts: [{ sprite: "apple", count: 9 }], layout: "sector" },
  mango: { parts: [{ sprite: "mango", count: 12 }], layout: "sector" },
  pomegranate: { parts: [{ sprite: "pomegranate", count: 36 }], layout: "sector" },
  almonds: { parts: [{ sprite: "almonds", count: 12 }], layout: "sector" },
  "dry-fruits": {
    parts: [
      { sprite: "dry-fruits", kind: 0, count: 6 },
      { sprite: "dry-fruits", kind: 1, count: 4 },
      { sprite: "dry-fruits", kind: 2, count: 6 },
    ],
    layout: "sector",
  },
  granola: { parts: [{ sprite: "granola", count: 11 }], layout: "sector" },
  raisins: { parts: [{ sprite: "raisins", count: 14 }], layout: "scatter" },
  "pumpkin-seeds": { parts: [{ sprite: "pumpkin-seeds", count: 16 }], layout: "scatter" },
  "cocoa-nibs": { parts: [{ sprite: "cocoa-nibs", count: 24 }], layout: "scatter" },
  "choco-chips": { parts: [{ sprite: "choco-chips", count: 22 }], layout: "scatter" },
  "icecream-scoop": { parts: [{ sprite: "icecream-scoop", count: 1 }], layout: "center", scale: [1, 1] },
  "plant-protein": { parts: [{ sprite: "plant-protein", count: 1 }], layout: "center", scale: [1, 1] },
  "whey-protein": { parts: [{ sprite: "whey-protein", count: 1 }], layout: "center", scale: [1, 1] },
};

const DUST: Partial<Record<IngredientId, { count: number; colors: string[]; size: [number, number] }>> = {
  chia: { count: 120, colors: ["#1e1b19", "#3a3631", "#5b554c"], size: [0.018, 0.026] },
  cinnamon: { count: 160, colors: ["#8a4a20", "#6e3815", "#a35b2a"], size: [0.012, 0.02] },
};

const DRIZZLE: Partial<Record<IngredientId, { color: string; light: string; width: number }>> = {
  "peanut-butter": { color: "#8f531d", light: "#e0ad6c", width: 8 },
  honey: { color: "#d4880a", light: "#ffe29a", width: 5.5 },
  "choco-sauce": { color: "#2f1408", light: "#946446", width: 6.5 },
};

const LEVEL: Partial<Record<IngredientId, number>> = { "regular-oats": 0.63, "oats-milk": 0.63, "extra-oats": 0.69 };

/* geometry ---------------------------------------------------------------- */

/** Percentages rounded so server and browser render identical markup. */
const pct = (v: number) => `${Math.round(v * 1e5) / 1e3}%`;
const num = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

const bowl = SPRITES.bowl;
const renderPPU = BOWL_PX / unitsAcross(BOWL_DIST);
const innerRadiusAt = (y: number) => {
  const t = Math.min(1, Math.max(0, (y - 0.08) / 0.84));
  return 0.58 + 0.62 * (1 - Math.pow(1 - t, 2)) - 0.07;
};

/** World point → position inside the cropped bowl box (fractions) + perspective scale. */
function toBox(p: [number, number, number]) {
  const s = projectToBowl(p);
  return {
    x: (s.x * BOWL_PX - bowl.crop.x) / bowl.crop.w,
    y: (s.y * BOWL_PX - bowl.crop.y) / bowl.crop.h,
    scale: s.scale,
  };
}

interface Placed {
  key: string;
  sprite: PieceSprite;
  style: CSSProperties;
  z: number;
}

function placePieces(id: IngredientId, sector: number, sectors: number, center: number, layer: number, level: number): Placed[] {
  const recipe = PIECE_RECIPES[id];
  if (!recipe) return [];
  const R = (innerRadiusAt(level) - 0.02) * 0.84;
  const out: Placed[] = [];
  const r = rng(hash(id) + sector * 31 + sectors * 7);
  const span = (Math.PI * 2) / sectors;
  const start = sector * span + 0.5;
  recipe.parts.forEach((part, pi) => {
    const variants = (PIECES[part.sprite] ?? []).filter((v) => (part.kind ?? 0) === v.kind);
    if (!variants.length) return;
    for (let i = 0; i < part.count; i++) {
      let a: number;
      let f: number;
      if (recipe.layout === "sector") {
        a = start + span * (0.04 + 0.92 * r());
        f = 0.18 + 0.78 * Math.sqrt(r());
      } else if (recipe.layout === "scatter") {
        a = r() * Math.PI * 2;
        f = Math.sqrt(r()) * 0.9;
      } else {
        const spots: [number, number][] = [
          [0, 0],
          [2.4, 0.42],
          [5.1, 0.4],
        ];
        [a, f] = spots[center % spots.length];
      }
      const x = Math.cos(a) * f * R;
      const z = Math.sin(a) * f * R;
      const y = level + 0.045 * (1 - f * f) + 0.025 + layer * 0.004;
      const v = variants[Math.floor(r() * variants.length)];
      // plated generously: slightly larger than life reads better at card size
      const scl = recipe.scale ? recipe.scale[0] : 1.02 + r() * 0.26;
      const p = toBox([x, y, z]);
      const wFrac = (v.w * renderPPU * p.scale * scl) / bowl.crop.w;
      const hFrac = (v.h * renderPPU * p.scale * scl) / bowl.crop.h;
      const spin = Math.round((r() - 0.5) * 70);
      // the 2D sprite may also be mirrored for variety
      const flip = r() > 0.5 ? -1 : 1;
      out.push({
        key: `${id}-${pi}-${i}`,
        sprite: v,
        z: z + layer * 0.02,
        style: {
          left: pct(p.x - v.ox * wFrac),
          top: pct(p.y - v.oy * hFrac),
          width: pct(wFrac),
          ["--spin" as string]: `${spin}deg`,
          ["--flip" as string]: flip,
          ["--fall" as string]: `${num(38 + r() * 18, 2)}cqh`,
          ["--delay" as string]: `${num((recipe.layout === "scatter" ? i * 0.012 : i * 0.05) + pi * 0.08)}s`,
          ["--dur" as string]: `${num(0.62 + r() * 0.18)}s`,
        },
      });
    }
  });
  return out;
}

function dustFor(id: IngredientId, level: number) {
  const d = DUST[id];
  if (!d) return [];
  const R = (innerRadiusAt(level) - 0.02) * 0.84;
  const r = rng(hash(id));
  return Array.from({ length: d.count }, (_, i) => {
    const a = r() * Math.PI * 2;
    const f = Math.sqrt(r()) * 0.92;
    const x = Math.cos(a) * f * R;
    const z = Math.sin(a) * f * R;
    const p = toBox([x, level + 0.06 + 0.04 * (1 - f * f) + r() * 0.04, z]);
    const size = (d.size[0] + r() * (d.size[1] - d.size[0])) * p.scale;
    return {
      key: `${id}-d${i}`,
      style: {
        left: pct(p.x),
        top: pct(p.y),
        width: pct((size * renderPPU) / bowl.crop.w),
        background: d.colors[i % d.colors.length],
        ["--fall" as string]: `${num(30 + r() * 20, 2)}cqh`,
        ["--delay" as string]: `${num(r() * 0.5)}s`,
        ["--dur" as string]: "0.55s",
      } as CSSProperties,
    };
  });
}

/**
 * Sauce flicked off a spoon: a few loose strokes across the bowl, each with a
 * slight curve and wobble, joined by soft turns — the way a chef drizzles.
 */
function drizzlePath(id: IngredientId, level: number) {
  const R = (innerRadiusAt(level) - 0.02) * 0.84;
  const r = rng(hash(id) + 3);
  const rot = (r() - 0.5) * 1.2;
  const passes = 4 + Math.floor(r() * 2);
  const pts: string[] = [];
  let first = true;
  for (let p = 0; p < passes; p++) {
    const zc = -0.62 + (1.24 * (p + 0.5)) / passes + (r() - 0.5) * 0.08;
    const half = Math.sqrt(Math.max(0, 0.8 - zc * zc)) * (0.75 + r() * 0.2);
    const dir = p % 2 ? -1 : 1;
    const bow = (r() - 0.5) * 0.25;
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = dir * (-half + 2 * half * u);
      const z = zc + bow * Math.sin(u * Math.PI) + 0.02 * Math.sin(u * 19 + p);
      const wx = (x * Math.cos(rot) - z * Math.sin(rot)) * R;
      const wz = (x * Math.sin(rot) + z * Math.cos(rot)) * R;
      const pt = toBox([wx, level + 0.12 + 0.015 * Math.sin(u * 13), wz]);
      pts.push(`${first ? "M" : "L"}${(pt.x * 1000).toFixed(1)} ${((pt.y * 1000) / (bowl.crop.w / bowl.crop.h)).toFixed(1)}`);
      first = false;
    }
  }
  return pts.join(" ");
}

/* component ---------------------------------------------------------------- */

export interface BowlSceneProps {
  ingredients: IngredientId[];
  /** Animate the build (drop-in). Static thumbnails pass false. */
  animate?: boolean;
  className?: string;
  /** Seconds before the first ingredient drops (lets the base pour first). */
  introDelay?: number;
  priority?: boolean;
  label?: string;
}

interface Entry {
  id: IngredientId;
  leaving: boolean;
  born: number;
}

export function BowlScene({ ingredients, animate = true, className, introDelay = 0.5, priority = false, label }: BowlSceneProps) {
  const base = ingredients.find((i) => BASES.includes(i)) ?? null;
  const food = ingredients.filter((i) => !BASES.includes(i));
  const level = base ? LEVEL[base] ?? 0.63 : 0.63;
  const foodKey = food.join("|");

  // keep removed ingredients briefly so they can animate out
  const [entries, setEntries] = useState<Entry[]>(() => food.map((id) => ({ id, leaving: false, born: 0 })));
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const wanted = foodKey ? (foodKey.split("|") as IngredientId[]) : [];
    setEntries((prev) => {
      const next: Entry[] = wanted.map((id) => prev.find((e) => e.id === id && !e.leaving) ?? { id, leaving: false, born: Date.now() });
      for (const e of prev) if (!wanted.includes(e.id) && !e.leaving) next.push({ ...e, leaving: true });
      return next;
    });
    const t = setTimeout(() => setEntries((prev) => prev.filter((e) => !e.leaving)), 480);
    return () => clearTimeout(t);
  }, [foodKey]);

  const live = entries.filter((e) => !e.leaving).map((e) => e.id);
  const sectorIds = live.filter((id) => PIECE_RECIPES[id]?.layout === "sector");
  const centerIds = live.filter((id) => PIECE_RECIPES[id]?.layout === "center");

  const layers = useMemo(() => {
    const all: (Placed & { leaving: boolean; entryDelay: number })[] = [];
    const dust: (ReturnType<typeof dustFor>[number] & { leaving: boolean; entryDelay: number })[] = [];
    const drizzles: { id: IngredientId; d: string; leaving: boolean; entryDelay: number }[] = [];
    entries.forEach((e, order) => {
      const entryDelay = e.born === 0 ? introDelay + order * 0.42 : 0;
      const sector = Math.max(0, sectorIds.indexOf(e.id));
      const sectors = Math.max(1, sectorIds.length);
      const center = Math.max(0, centerIds.indexOf(e.id));
      for (const p of placePieces(e.id, sector, sectors, center, order, level)) all.push({ ...p, leaving: e.leaving, entryDelay });
      for (const d of dustFor(e.id, level)) dust.push({ ...d, leaving: e.leaving, entryDelay });
      if (DRIZZLE[e.id]) drizzles.push({ id: e.id, d: drizzlePath(e.id, level), leaving: e.leaving, entryDelay });
    });
    all.sort((a, b) => a.z - b.z);
    return { all, dust, drizzles };
    // sector assignment is derived from `entries`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, level, introDelay]);

  const aspect = bowl.crop.w / bowl.crop.h;
  const bed = base === "oats-milk" ? bowl.layers["bed-milk"] ?? bowl.layers.bed : bowl.layers.bed;

  return (
    <div
      className={clsx("nr-bowl relative w-full select-none [container-type:size]", animate ? "nr-animate" : "nr-static", className)}
      style={{ aspectRatio: `${aspect}` }}
      role="img"
      aria-label={label ?? "Your bowl"}
    >
      {/* soft contact shadow on the counter */}
      <div aria-hidden className="absolute bottom-[3%] left-1/2 h-[12%] w-[66%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(60,40,15,0.32),rgba(60,40,15,0))] blur-[2px]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bowl.layers.back} alt="" draggable={false} className="absolute inset-0 h-full w-full" loading={priority ? "eager" : "lazy"} decoding="async" />
      {base && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={base}
          src={bed}
          alt=""
          draggable={false}
          className="nr-bed absolute inset-0 h-full w-full"
          style={base === "extra-oats" ? { translate: "0 -3.2%", scale: "1.045" } : undefined}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      {layers.dust.map((d) => (
        <span
          key={d.key}
          aria-hidden
          className={clsx("nr-drop absolute aspect-square rounded-full", d.leaving && "nr-leave")}
          style={{ ...d.style, ["--entry" as string]: `${d.entryDelay}s` }}
        />
      ))}
      {layers.all.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.key}
          src={p.sprite.src}
          alt=""
          draggable={false}
          aria-hidden
          className={clsx("nr-drop absolute h-auto drop-shadow-[0_2px_2px_rgba(60,35,10,0.35)]", p.leaving && "nr-leave")}
          style={{ ...p.style, ["--entry" as string]: `${p.entryDelay}s` }}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
      {layers.drizzles.length > 0 && (
        <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 1000 ${(1000 / aspect).toFixed(1)}`} preserveAspectRatio="none">
          {layers.drizzles.map((z) => {
            const c = DRIZZLE[z.id]!;
            return (
              <g key={z.id} className={clsx("nr-drizzle", z.leaving && "nr-leave")} style={{ ["--entry" as string]: `${z.entryDelay}s` }}>
                <path d={z.d} pathLength={1} fill="none" stroke="rgba(50,25,5,0.28)" strokeWidth={c.width + 3} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 4)" />
                <path d={z.d} pathLength={1} fill="none" stroke={c.color} strokeWidth={c.width} strokeLinecap="round" strokeLinejoin="round" opacity={z.id === "honey" ? 0.86 : 1} />
                <path d={z.d} pathLength={1} fill="none" stroke={c.light} strokeWidth={c.width * 0.28} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} transform="translate(-1.5 -2)" />
              </g>
            );
          })}
        </svg>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bowl.layers.front} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" loading={priority ? "eager" : "lazy"} decoding="async" />
    </div>
  );
}
