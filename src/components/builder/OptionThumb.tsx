import { Ban, Droplet, Snowflake, Milk } from "lucide-react";
import type { IngredientId } from "@/data/builders";
import { PIECES, SPRITES } from "@/data/sprites";

/** Small picture for a builder option chip. */
export function OptionThumb({ id }: { id: IngredientId }) {
  const piece = PIECES[id]?.[0];
  if (piece) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={piece.src} alt="" aria-hidden className="h-full w-full object-contain drop-shadow-[0_2px_2px_rgba(60,35,10,0.3)]" loading="lazy" />;
  }
  if (id === "regular-oats" || id === "extra-oats" || id === "oats-milk") {
    const src = id === "oats-milk" ? SPRITES.bowl.layers["bed-milk"] : SPRITES.bowl.layers.bed;
    return (
      <span className="relative block h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden className="absolute left-1/2 top-[42%] w-[185%] max-w-none -translate-x-1/2 -translate-y-1/2" style={id === "extra-oats" ? { scale: "1.15" } : undefined} loading="lazy" />
      </span>
    );
  }
  if (id === "dry-fruits") {
    const a = PIECES["dry-fruits"];
    return (
      <span className="relative block h-full w-full">
        {a?.slice(0, 3).map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={p.src} alt="" aria-hidden className="absolute w-[52%]" style={{ left: `${[6, 42, 24][i]}%`, top: `${[18, 26, 50][i]}%` }} />
        ))}
      </span>
    );
  }
  if (id === "chia" || id === "cinnamon") {
    const c = id === "chia" ? ["#1e1b19", "#4a4540", "#2f2b27"] : ["#8a4a20", "#a35b2a", "#6e3815"];
    return (
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
        <ellipse cx="20" cy="26" rx="15" ry="7" fill="#efe2c6" />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={8 + ((i * 37) % 24)} cy={21 + ((i * 13) % 9)} r={id === "chia" ? 1.1 : 0.9} fill={c[i % 3]} />
        ))}
      </svg>
    );
  }
  if (id === "honey" || id === "choco-sauce" || id === "peanut-butter") {
    const col = id === "honey" ? "#e39a12" : id === "choco-sauce" ? "#341709" : "#9c5d26";
    return (
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
        <path d="M20 5 C 28 17, 31 22, 31 27 a 11 11 0 0 1 -22 0 C 9 22, 12 17, 20 5 Z" fill={col} />
        <path d="M14 26 a 6 6 0 0 0 4 6" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (id.endsWith("-milk")) {
    const col = id === "almond-milk" ? "#efe2cb" : id === "oat-milk" ? "#eee1c5" : id === "coconut-milk" ? "#fcfaf4" : "#f7f2e7";
    return (
      <span className="grid h-full w-full place-items-center rounded-xl" style={{ background: `radial-gradient(circle at 50% 40%, #fff, ${col})` }}>
        <Milk size={22} className="text-navy-700" />
      </span>
    );
  }
  if (id === "no-protein") return <Ban size={22} className="mx-auto text-ink-muted" />;
  if (id.startsWith("ice-")) return <Snowflake size={22} className="mx-auto text-sky-600" />;
  if (id.startsWith("sweet-")) return <Droplet size={22} className="mx-auto text-gold-600" />;
  return null;
}
