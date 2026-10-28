import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1200px",
      xl: "1440px",
    },
    extend: {
      colors: {
        navy: {
          950: "#071226",
          900: "#0b1a33",
          800: "#10264a",
          700: "#173463",
          600: "#1f4380",
          500: "#2c5aa6",
        },
        gold: {
          700: "#7d5f1c",
          600: "#a8812f",
          500: "#c9a04a",
          400: "#d9b86a",
          300: "#e8d3a0",
          200: "#f2e6c8",
        },
        ivory: "#fbf6ec",
        cream: "#f6eedd",
        sand: {
          DEFAULT: "#ecdfc6",
          200: "#f1e7d3",
          400: "#dccbaa",
          600: "#b9a47c",
        },
        ink: {
          DEFAULT: "#0b1a33",
          soft: "#3c4559",
          muted: "#6b6252",
        },
        veg: "#1f8a3a",
        nonveg: "#a3361f",
        egg: "#c27c0e",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,26,51,0.06), 0 8px 24px -12px rgba(11,26,51,0.18)",
        lift: "0 2px 4px rgba(11,26,51,0.06), 0 22px 40px -18px rgba(11,26,51,0.35)",
        gold: "0 10px 30px -12px rgba(201,160,74,0.65)",
        sheet: "0 -12px 40px -12px rgba(11,26,51,0.3)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
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
        shimmer: "shimmer 2.4s ease-in-out infinite",
        sway: "sway 14s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        skeleton: "skeleton 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
