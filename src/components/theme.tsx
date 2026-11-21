"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { clsx } from "@/lib/clsx";

export type ThemePref = "light" | "dark" | "system";
const KEY = "nr-theme";

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;d?c.add('dark'):c.remove('dark');}catch(e){}})();`;

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", dark ? "#111928" : "#F4EEE2");
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => {
    try {
      setPref((localStorage.getItem(KEY) as ThemePref) || "system");
    } catch {
      /* storage blocked */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      try {
        if ((localStorage.getItem(KEY) || "system") === "system") apply("system");
      } catch {
        apply("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const set = useCallback((p: ThemePref) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* storage blocked: still applies for this visit */
    }
    apply(p);
  }, []);
  return { pref, set };
}

/** Light / Dark / System segmented control. */
export function ThemeSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { pref, set } = useTheme();
  const opts: { v: ThemePref; label: string; icon: typeof Sun }[] = [
    { v: "light", label: "Light", icon: Sun },
    { v: "dark", label: "Dark", icon: Moon },
    { v: "system", label: "System", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className={clsx("inline-flex rounded-lg border border-line bg-surface p-0.5", className)}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={pref === o.v}
          title={o.label}
          onClick={() => set(o.v)}
          className={clsx(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-semibold transition-colors",
            pref === o.v ? "bg-primary-soft text-fg" : "text-muted hover:text-fg",
          )}
        >
          <o.icon size={14} aria-hidden />
          {!compact && o.label}
          {compact && <span className="sr-only">{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
