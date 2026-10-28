"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "@/store/app";

/** True once the persisted app store has been read from storage on the client. */
export function useAppHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const p = useApp.persist;
    if (p.hasHydrated()) setHydrated(true);
    return p.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** Lock page scroll while an overlay is open (ref-counted so overlays can stack). */
let scrollLocks = 0;
let savedOverflow = "";
let savedPadding = "";

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { body, documentElement } = document;
    if (scrollLocks === 0) {
      savedOverflow = body.style.overflow;
      savedPadding = body.style.paddingRight;
      const gap = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (gap > 0) body.style.paddingRight = `${gap}px`;
    }
    scrollLocks++;
    return () => {
      scrollLocks--;
      if (scrollLocks === 0) {
        body.style.overflow = savedOverflow;
        body.style.paddingRight = savedPadding;
      }
    };
  }, [locked]);
}

/** Close on Escape. */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, onEscape]);
}

/** Whether WebGL is usable on this device. */
export function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      setOk(!!gl);
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}
