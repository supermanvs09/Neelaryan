import { clsx } from "@/lib/clsx";

/**
 * The NEELARYAN wordmark: high-contrast navy serif with the gold swash that
 * sweeps from the "N" under the name, plus the tagline between gold rules.
 */
export function Wordmark({
  className,
  tagline = true,
  tone = "navy",
  animate = false,
}: {
  className?: string;
  tagline?: boolean;
  tone?: "navy" | "ivory";
  animate?: boolean;
}) {
  const ink = tone === "navy" ? "text-navy-900" : "text-ivory";
  return (
    <span className={clsx("relative inline-flex flex-col items-center leading-none", className)}>
      <span className="relative">
        <span className={clsx("font-display font-semibold tracking-[-0.01em]", ink)} style={{ fontSize: "1em" }}>
          Neelaryan
        </span>
        <svg
          aria-hidden
          viewBox="0 0 400 60"
          className="pointer-events-none absolute left-[-6%] top-[52%] h-[0.62em] w-[112%] overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="nr-gold" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#8a6a22" />
              <stop offset="0.35" stopColor="#d9b86a" />
              <stop offset="0.55" stopColor="#f6e3ad" />
              <stop offset="0.75" stopColor="#c9a04a" />
              <stop offset="1" stopColor="#8a6a22" />
            </linearGradient>
          </defs>
          <path
            className={animate ? "nr-swash" : undefined}
            d="M8 6 C 40 40, 90 52, 170 44 S 320 22, 396 30"
            fill="none"
            stroke="url(#nr-gold)"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
      </span>
      {tagline && (
        <span className="mt-[0.34em] flex items-center gap-[0.5em] text-[0.16em] font-semibold uppercase tracking-[0.42em] text-navy-800">
          <span className="h-px w-[2.2em] bg-gold-500" />
          <span className={tone === "navy" ? "text-navy-800" : "text-gold-200"}>Crave the goodness</span>
          <span className="h-px w-[2.2em] bg-gold-500" />
        </span>
      )}
    </span>
  );
}
