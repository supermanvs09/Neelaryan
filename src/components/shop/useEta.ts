"use client";

import { useEffect, useState } from "react";

/** "Ready in about N min", refreshed every minute while shown. */
export function useEta(enabled: boolean) {
  const [eta, setEta] = useState<{ minutes: number; busy: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return setEta(null);
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/public/eta", { cache: "no-store" });
        const j = (await r.json()) as { minutes: number | null; queue?: number };
        if (!stop) setEta(j.minutes ? { minutes: j.minutes, busy: (j.queue ?? 0) >= 6 } : null);
      } catch {
        /* keep the last value */
      }
    };
    load();
    const i = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearInterval(i);
    };
  }, [enabled]);
  return eta;
}
