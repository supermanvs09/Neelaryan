"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Garnish, IngredientId } from "@/data/builders";
import { PIECES } from "@/data/sprites";
import { clsx } from "@/lib/clsx";
import { hash, rng } from "@/lib/random";

/**
 * Layered HTML/CSS/SVG milkshake: back of the glass → liquid (pours in as milk,
 * then swirls into the flavour) → ice cubes (real CSS 3D boxes) → toppings &
 * garnish → front glass with highlights, condensation, gold rim and wordmark.
 */

const MILK: Partial<Record<IngredientId, string>> = {
  "regular-milk": "#f7f2e7",
  "almond-milk": "#efe2cb",
  "oat-milk": "#eee1c5",
  "coconut-milk": "#fcfaf4",
};

const SAUCE: Partial<Record<Garnish, string>> = {
  "choco-drizzle": "#3b1d10",
  "caramel-drizzle": "#b8741e",
  "pb-drizzle": "#9c5d26",
};

// interior of the glass in % of the scene box
const TOP_Y = 13;
const BOT_Y = 89;
const TOP_L = 19.5;
const TOP_R = 80.5;
const BOT_L = 27.5;
const BOT_R = 72.5;
const xAt = (yPct: number, side: "l" | "r") => {
  const t = (yPct - TOP_Y) / (BOT_Y - TOP_Y);
  return side === "l" ? TOP_L + (BOT_L - TOP_L) * t : TOP_R + (BOT_R - TOP_R) * t;
};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [ar, ag, ab] = ch(pa);
  const [br, bg, bb] = ch(pb);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function IceCube({ style, size }: { style: CSSProperties; size: number }) {
  const face = "absolute inset-0 rounded-[18%] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.75),rgba(220,236,245,0.25)_55%,rgba(255,255,255,0.45))]";
  const half = `${size / 2}cqw`;
  return (
    <span className="nr-ice absolute [transform-style:preserve-3d]" style={{ width: `${size}cqw`, height: `${size}cqw`, ...style }} aria-hidden>
      <span className={face} style={{ transform: `translateZ(${half})` }} />
      <span className={face} style={{ transform: `rotateY(180deg) translateZ(${half})` }} />
      <span className={face} style={{ transform: `rotateY(90deg) translateZ(${half})` }} />
      <span className={face} style={{ transform: `rotateY(-90deg) translateZ(${half})` }} />
      <span className={face} style={{ transform: `rotateX(90deg) translateZ(${half})` }} />
      <span className={face} style={{ transform: `rotateX(-90deg) translateZ(${half})` }} />
    </span>
  );
}

export interface GlassSceneProps {
  ingredients: IngredientId[];
  flavour: string;
  garnish: Garnish;
  animate?: boolean;
  className?: string;
  label?: string;
}

export function GlassScene({ ingredients, flavour, garnish, animate = true, className, label }: GlassSceneProps) {
  const base = ingredients.find((i) => i.endsWith("-milk")) ?? "regular-milk";
  const milk = MILK[base] ?? "#f7f2e7";
  const scoop = ingredients.includes("icecream-scoop");
  const ice = ingredients.includes("ice-none") ? 0 : ingredients.includes("ice-less") ? 2 : 3;
  const protein = ingredients.includes("plant-protein") || ingredients.includes("whey-protein");
  const toppings = ingredients.filter((i) => ["choco-chips", "almonds", "granola", "peanut-butter"].includes(i));
  const liquid = mix(flavour, milk, 0.12);
  const fill = scoop ? 74 : 79; // % of the interior height

  // pour → blend sequence on first show
  const [phase, setPhase] = useState<"empty" | "pour" | "blend" | "done">(animate ? "empty" : "done");
  useEffect(() => {
    if (!animate) return;
    const a = setTimeout(() => setPhase("pour"), 250);
    const b = setTimeout(() => setPhase("blend"), 1650);
    const c = setTimeout(() => setPhase("done"), 2700);
    return () => [a, b, c].forEach(clearTimeout);
  }, [animate]);

  // a burst of powder when protein is added later
  const [puff, setPuff] = useState(0);
  const hadProtein = useRef(protein);
  useEffect(() => {
    if (protein && !hadProtein.current) setPuff((p) => p + 1);
    hadProtein.current = protein;
  }, [protein]);

  const surfaceY = BOT_Y - ((BOT_Y - TOP_Y) * fill) / 100; // % from top
  const level = phase === "empty" ? 0 : fill;
  const color = phase === "empty" || phase === "pour" ? milk : liquid;

  const drops = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 34 }, () => {
      const y = 20 + r() * 66;
      const x = xAt(y, "l") + 2 + r() * (xAt(y, "r") - xAt(y, "l") - 4);
      return { x: r3(x), y: r3(y), s: r3(0.5 + r() * 1.3), o: r3(0.35 + r() * 0.5) };
    });
  }, []);

  const toppingPieces = useMemo(() => {
    const out: { key: string; src: string; style: CSSProperties }[] = [];
    toppings.forEach((id, ti) => {
      const sprite = id === "peanut-butter" ? null : PIECES[id];
      if (!sprite?.length) return;
      const r = rng(hash(id));
      const n = id === "choco-chips" ? 12 : id === "granola" ? 7 : 6;
      for (let i = 0; i < n; i++) {
        const v = sprite[Math.floor(r() * sprite.length)];
        const ySurf = surfaceY - (scoop ? 6 : 0);
        const half = ((xAt(ySurf, "r") - xAt(ySurf, "l")) / 2) * 0.8;
        const x = 50 + (r() * 2 - 1) * half;
        const y = ySurf - 1.5 + (r() - 0.5) * 3.2;
        const w = v.w * 34; // world units → % of scene width
        out.push({
          key: `${id}-${i}`,
          src: v.src,
          style: {
            left: `${r3(x - w * v.ox)}%`,
            top: `${r3(y - w * v.oy * (v.h / v.w) * 0.75)}%`,
            width: `${r3(w)}%`,
            zIndex: Math.round(y * 10),
            ["--spin" as string]: `${Math.round((r() - 0.5) * 80)}deg`,
            ["--flip" as string]: r() > 0.5 ? -1 : 1,
            ["--fall" as string]: `${r3(45 + r() * 15)}cqh`,
            ["--delay" as string]: `${r3(i * 0.04 + ti * 0.12)}s`,
            ["--entry" as string]: animate ? "2.4s" : "0s",
            ["--dur" as string]: "0.6s",
          },
        });
      }
    });
    return out;
  }, [toppings.join("|"), surfaceY, scoop, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  const sauce = SAUCE[garnish];
  const scoopSprite = PIECES["icecream-scoop"]?.[0];
  const garnishSprite = garnish === "banana" ? PIECES["banana"]?.[1] : garnish === "pista" || garnish === "saffron-almond" ? PIECES["almonds"]?.[0] : null;

  return (
    <div
      className={clsx("nr-glass relative aspect-[3/4] w-full select-none [container-type:size]", animate ? "nr-animate" : "nr-static", className)}
      role="img"
      aria-label={label ?? "Your milkshake"}
      style={{ ["--liquid" as string]: color } as CSSProperties}
    >
      {/* counter shadow */}
      <div aria-hidden className="absolute bottom-[4.5%] left-1/2 h-[7%] w-[56%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(60,40,15,0.3),rgba(60,40,15,0))]" />

      {/* back of the glass */}
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="gl-back" x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="#e9eef2" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path d={`M${TOP_L - 1.5} ${TOP_Y - 1} L${TOP_R + 1.5} ${TOP_Y - 1} L${BOT_R + 1.2} ${BOT_Y + 1} Q50 ${BOT_Y + 3} ${BOT_L - 1.2} ${BOT_Y + 1} Z`} fill="url(#gl-back)" />
        <ellipse cx="50" cy={TOP_Y - 1} rx={(TOP_R - TOP_L) / 2 + 1.5} ry="2.6" fill="none" stroke="rgba(120,130,140,0.35)" strokeWidth="0.5" />
      </svg>

      {/* liquid, clipped to the glass interior */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `polygon(${TOP_L}% ${TOP_Y}%, ${TOP_R}% ${TOP_Y}%, ${BOT_R}% ${BOT_Y}%, ${BOT_L}% ${BOT_Y}%)` }}
        aria-hidden
      >
        <div
          className="nr-liquid absolute inset-x-0 bottom-[11%]"
          style={{
            height: `${((BOT_Y - TOP_Y) * level) / 100}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, var(--liquid) 82%, #000) 0%, var(--liquid) 22%, color-mix(in srgb, var(--liquid) 88%, #fff) 50%, var(--liquid) 78%, color-mix(in srgb, var(--liquid) 80%, #000) 100%)`,
          }}
        >
          {/* foam band + gentle wave */}
          <div className="absolute inset-x-0 top-0 h-[7%] bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0))]" />
          <svg className="nr-wave absolute -top-[2.2cqh] left-0 h-[3cqh] w-[200%]" viewBox="0 0 200 10" preserveAspectRatio="none">
            <path d="M0 5 Q 12.5 0 25 5 T 50 5 T 75 5 T 100 5 T 125 5 T 150 5 T 175 5 T 200 5 V10 H0 Z" fill="var(--liquid)" />
          </svg>
          {/* swirl while blending */}
          {phase === "blend" && <div className="nr-swirl absolute inset-0" style={{ background: `conic-gradient(from 0deg at 50% 60%, ${milk}, ${liquid}, ${milk}, ${liquid}, ${milk})` }} />}
          {/* bubbles */}
          {animate &&
            [12, 28, 46, 63, 80].map((x, i) => (
              <span key={i} className="nr-bubble absolute bottom-0 aspect-square w-[3.2%] rounded-full border border-white/70 bg-white/25" style={{ left: `${x}%`, animationDelay: `${i * 0.7}s` }} />
            ))}
        </div>
        {/* sauce drips down the inside wall */}
        {sauce && phase === "done" && (
          <svg className="nr-drips absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {[22, 30, 39, 47, 55, 63, 71, 78].map((x, i) => (
              <path key={i} d={`M${x} ${TOP_Y} V${TOP_Y + 8 + ((i * 37) % 23)} q 1.2 2 2.4 0 V${TOP_Y}`} fill={sauce} opacity="0.9" />
            ))}
            <rect x="0" y={TOP_Y} width="100" height="2.2" fill={sauce} />
          </svg>
        )}
      </div>

      {/* pour stream */}
      <div
        aria-hidden
        className={clsx("nr-stream absolute left-1/2 top-0 w-[5%] -translate-x-1/2 rounded-b-full", phase === "pour" ? "opacity-100" : "opacity-0")}
        style={{ height: `${surfaceY}%`, background: `linear-gradient(90deg, ${mix(milk, "#000000", 0.08)}, ${milk} 45%, #ffffff 60%, ${milk})` }}
      />

      {/* ice cubes (CSS 3D) */}
      <div className="absolute inset-0 [perspective:400px]" aria-hidden>
        {Array.from({ length: ice }, (_, i) => (
          <IceCube
            key={i}
            size={11}
            style={{
              left: `${36 + i * 11}%`,
              top: `${surfaceY - 4 + (i % 2) * 2.5}%`,
              ["--r" as string]: `${20 + i * 33}deg`,
              ["--d" as string]: `${i * 0.4}s`,
              opacity: phase === "empty" ? 0 : 1,
            }}
          />
        ))}
      </div>

      {/* protein puff */}
      {puff > 0 && (
        <div key={puff} aria-hidden className="absolute inset-0">
          {Array.from({ length: 22 }, (_, i) => (
            <span key={i} className="nr-puff absolute aspect-square w-[1.4%] rounded-full bg-[#f4eddc]" style={{ left: `${40 + ((i * 37) % 20)}%`, top: "4%", ["--y" as string]: `${surfaceY - 4}cqh`, animationDelay: `${(i % 7) * 0.05}s` } as CSSProperties} />
          ))}
        </div>
      )}

      {/* toppings on the foam */}
      {toppingPieces.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.key} src={p.src} alt="" aria-hidden draggable={false} className="nr-drop absolute h-auto drop-shadow-[0_1.5px_1.5px_rgba(60,35,10,0.35)]" style={p.style} loading="lazy" decoding="async" />
      ))}
      {toppings.includes("peanut-butter") && (
        <svg aria-hidden className="nr-drizzle absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ["--entry" as string]: animate ? "2.6s" : "0s" } as CSSProperties}>
          <path d={`M30 ${surfaceY - 1} Q40 ${surfaceY - 4} 50 ${surfaceY - 0.5} T 70 ${surfaceY - 1.5}`} pathLength={1} fill="none" stroke="#93561f" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}

      {/* ice-cream scoop crowning the glass */}
      {scoop && scoopSprite && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={scoopSprite.src}
          alt=""
          aria-hidden
          className="nr-drop absolute left-1/2 h-auto w-[40%] drop-shadow-[0_4px_4px_rgba(60,35,10,0.3)]"
          style={{ top: `${surfaceY - 15}%`, marginLeft: "-20%", ["--fall" as string]: "40cqh", ["--entry" as string]: animate ? "2.5s" : "0s", ["--dur" as string]: "0.7s" } as CSSProperties}
        />
      )}
      {garnishSprite && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={garnishSprite.src} alt="" aria-hidden className="absolute h-auto w-[16%] drop-shadow-sm" style={{ left: "64%", top: `${TOP_Y - 8}%`, transform: "rotate(-24deg)" }} />
      )}
      {garnish === "oreo" && (
        <div aria-hidden className="absolute left-[60%] top-[1%] h-[15%] w-[22%] -rotate-[18deg]">
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_40%_35%,#3b302c,#191311)] shadow-md" />
          <span className="absolute inset-x-[4%] top-[42%] h-[16%] rounded-full bg-[#f6f1e6]" />
          <span className="absolute inset-0 top-[52%] rounded-b-full bg-[radial-gradient(circle_at_40%_80%,#2f2522,#140f0e)]" />
        </div>
      )}
      {garnish === "kitkat" && (
        <div aria-hidden className="absolute left-[58%] top-[-3%] h-[30%] w-[11%] rotate-[14deg] rounded-[3px] bg-[linear-gradient(90deg,#4a2615,#7a4527_50%,#4a2615)] shadow-md">
          <span className="absolute inset-x-0 bottom-0 h-[42%] rounded-b-[3px] bg-[linear-gradient(90deg,#a3141e,#d4242e_50%,#a3141e)]" />
        </div>
      )}

      {/* straw */}
      <div aria-hidden className="absolute left-[39%] top-[-6%] h-[62%] w-[4.4%] origin-bottom -rotate-[12deg] rounded-full bg-[repeating-linear-gradient(160deg,#10264a_0_7%,#c9a04a_7%_14%)] shadow-[inset_-2px_0_3px_rgba(0,0,0,0.25)]" />

      {/* front of the glass */}
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="gl-hi" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.0" />
            <stop offset="0.12" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.2" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="0.88" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="gl-gold" x1="0" x2="1">
            <stop offset="0" stopColor="#8a6a22" />
            <stop offset="0.45" stopColor="#f2dc9c" />
            <stop offset="1" stopColor="#a8812f" />
          </linearGradient>
        </defs>
        <path d={`M${TOP_L - 1.5} ${TOP_Y - 1} L${TOP_R + 1.5} ${TOP_Y - 1} L${BOT_R + 1.2} ${BOT_Y + 1} Q50 ${BOT_Y + 3} ${BOT_L - 1.2} ${BOT_Y + 1} Z`} fill="url(#gl-hi)" stroke="rgba(150,160,170,0.45)" strokeWidth="0.35" />
        {/* thick base */}
        <path d={`M${BOT_L - 1.2} ${BOT_Y + 1} Q50 ${BOT_Y + 3} ${BOT_R + 1.2} ${BOT_Y + 1} L${BOT_R + 1.3} ${BOT_Y + 5} Q50 ${BOT_Y + 7.5} ${BOT_L - 1.3} ${BOT_Y + 5} Z`} fill="rgba(235,240,244,0.55)" stroke="rgba(150,160,170,0.4)" strokeWidth="0.3" />
        {/* rim: front arc + gold */}
        <path d={`M${TOP_L - 1.5} ${TOP_Y - 1} A ${(TOP_R - TOP_L) / 2 + 1.5} 2.6 0 0 0 ${TOP_R + 1.5} ${TOP_Y - 1}`} fill="none" stroke="url(#gl-gold)" strokeWidth="0.9" />
        {drops.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.s * 0.45} fill="rgba(255,255,255,0.55)" opacity={d.o} />
        ))}
      </svg>
      <p aria-hidden className="absolute inset-x-0 top-[53%] text-center font-display text-[9cqw] font-semibold leading-none text-navy-900/80 [text-shadow:0_1px_0_rgba(255,255,255,0.4)]">
        Neelaryan
        <span className="mt-[1.2cqw] block text-[2.1cqw] font-sans font-bold uppercase tracking-[0.4em] text-gold-700/90">Crave the goodness</span>
      </p>
    </div>
  );
}
