"use client";

import { useEffect, useState } from "react";

/**
 * Resolves the next/font display family (a hashed name) and waits until it is
 * loaded, so canvas-drawn lettering on 3D objects uses the brand serif.
 */
export function useDisplayFont() {
  const [family, setFamily] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const css = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    const fam = css || "Georgia, serif";
    const done = () => {
      if (alive) setFamily(fam);
    };
    if (!document.fonts?.load) {
      done();
      return;
    }
    Promise.race([
      document.fonts.load(`600 64px ${fam}`),
      new Promise((r) => setTimeout(r, 2500)),
    ])
      .catch(() => undefined)
      .finally(done);
    return () => {
      alive = false;
    };
  }, []);
  return family;
}
