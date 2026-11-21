import type { Config } from "tailwindcss";

/**
 * Colours are CSS variables (space-separated RGB channels) defined in
 * globals.css for light and dark themes, so every utility — including opacity
 * modifiers like bg-primary/10 — follows the active theme.
 *
 * Source palette (sampled from the brand palette image):
 *   Champagne #DBC7AC · Ivory #F4EEE2 · French Blue #7A94AC · Gold #B58A45 · Navy #23324C
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1200px",
      xl: "1440px",
    },
    extend: {
      colors: {
        // semantic tokens (admin + new UI)
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        line: v("line"),
        "line-strong": v("line-strong"),
        fg: v("fg"),
        muted: v("muted"),
        primary: { DEFAULT: v("primary"), fg: v("primary-fg"), hover: v("primary-hover"), soft: v("primary-soft") },
        accent: { DEFAULT: v("accent"), fg: v("accent-fg"), soft: v("accent-soft"), text: v("accent-text") },
        danger: { DEFAULT: v("danger"), soft: v("danger-soft") },
        success: { DEFAULT: v("success"), soft: v("success-soft") },
        warning: { DEFAULT: v("warning"), soft: v("warning-soft") },
        // brand palette (fixed, for brand moments)
        champagne: "#DBC7AC",
        "french-blue": "#7A94AC",
        // legacy names used by the customer app — theme-aware
        white: v("white"),
        navy: { 950: v("navy-950"), 900: v("navy-900"), 800: v("navy-800"), 700: v("navy-700"), 600: v("navy-600"), 500: v("navy-500") },
        gold: { 700: v("gold-700"), 600: v("gold-600"), 500: v("gold-500"), 400: v("gold-400"), 300: v("gold-300"), 200: v("gold-200") },
        ivory: v("ivory"),
        cream: v("cream"),
        sand: { DEFAULT: v("sand"), 200: v("sand-200"), 400: v("sand-400"), 600: v("sand-600") },
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted") },
        veg: v("veg"),
        nonveg: v("nonveg"),
        egg: v("egg"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 4px 14px -8px rgb(var(--shadow) / 0.18)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.08), 0 12px 28px -14px rgb(var(--shadow) / 0.35)",
        gold: "0 6px 18px -10px rgb(var(--shadow) / 0.35)",
        sheet: "0 -8px 30px -12px rgb(var(--shadow) / 0.3)",
        pop: "0 10px 30px -10px rgb(var(--shadow) / 0.35)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        sway: {
          "0%, 100%": { transform: "translate3d(0,0,0) rotate(0deg)" },
          "50%": { transform: "translate3d(12px,-6px,0) rotate(1.5deg)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        skeleton: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        sway: "sway 14s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        skeleton: "skeleton 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
