import { clsx } from "@/lib/clsx";

/**
 * NEELARYAN logo, drawn as vector so it stays crisp from a 24 px header to a printed bill:
 * the serif wordmark in brand navy with the gold ribbon that sweeps from the N under the
 * name, and optionally the “CRAVE THE GOODNESS.” line between gold rules.
 *
 * Colours come from --brand-ink / --brand-gold, so the ink flips to ivory on navy
 * surfaces (dark mode, the console sidebar) while the gold stays gold.
 */
export function Logo({ tagline = false, className, title = "Neelaryan — Crave the goodness" }: { tagline?: boolean; className?: string; title?: string }) {
  return (
    <svg viewBox={tagline ? "0 0 520 168" : "0 0 520 128"} className={clsx("block h-auto", className)} role="img" aria-label={title}>
      <title>{title}</title>
      {/* gold flourish entering the N */}
      <path d="M74 30 C 58 12, 22 14, 14 36 C 10 48, 18 56, 28 52 C 20 50, 18 40, 26 32 C 36 22, 56 22, 74 30 Z" fill="rgb(var(--brand-gold))" />
      <text
        x="24"
        y="98"
        textLength="476"
        lengthAdjust="spacingAndGlyphs"
        fill="rgb(var(--brand-ink))"
        style={{ fontFamily: "var(--font-display), 'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 92, letterSpacing: "-0.01em" }}
      >
        Neelaryan
      </text>
      {/* the ribbon: thin at both ends, fullest under the middle of the name */}
      <path d="M30 108 C 150 130, 340 124, 508 92 C 344 116, 156 120, 30 108 Z" fill="rgb(var(--brand-gold))" />
      {tagline && (
        <g>
          <line x1="40" y1="150" x2="112" y2="150" stroke="rgb(var(--brand-gold))" strokeWidth="1.5" />
          <line x1="408" y1="150" x2="480" y2="150" stroke="rgb(var(--brand-gold))" strokeWidth="1.5" />
          <text x="260" y="155" textAnchor="middle" fill="rgb(var(--brand-ink))" style={{ fontFamily: "var(--font-sans), Inter, system-ui, sans-serif", fontWeight: 500, fontSize: 15, letterSpacing: "0.32em" }}>
            CRAVE THE GOODNESS.
          </text>
        </g>
      )}
    </svg>
  );
}

/** Square monogram for tight spots (collapsed sidebar, avatars): gold serif N on navy. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx("block", className)} role="img" aria-label="Neelaryan">
      <rect width="64" height="64" rx="14" fill="#0B2A55" />
      <text x="32" y="45" textAnchor="middle" fill="#E2BF7A" style={{ fontFamily: "var(--font-display), 'Playfair Display', Georgia, serif", fontWeight: 600, fontSize: 40 }}>
        N
      </text>
      <path d="M12 50 C 26 56, 42 55, 54 46 C 42 52, 26 53, 12 50 Z" fill="#C29545" />
    </svg>
  );
}
