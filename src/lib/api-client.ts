"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** JSON fetch against our API with consistent error handling. */
export async function apiFetch<T = unknown>(url: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ClientApiError(0, "You seem to be offline. Check the connection and try again.", "NETWORK");
  }
  if (res.ok) {
    const type = res.headers.get("content-type") ?? "";
    return (type.includes("json") ? await res.json() : await res.text()) as T;
  }
  let payload: { error?: string; code?: string; fields?: Record<string, string> } = {};
  try {
    payload = await res.json();
  } catch {
    /* not JSON */
  }
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    if (res.status === 401) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    if (payload.code === "PASSWORD_CHANGE_REQUIRED") window.location.href = "/change-password";
  }
  throw new ClientApiError(res.status, payload.error ?? `Request failed (${res.status}).`, payload.code, payload.fields);
}

export interface ApiState<T> {
  data: T | undefined;
  error: ClientApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Loads JSON from `url` (null = don't load). `refreshMs` polls while the tab is
 * visible — used for live boards (orders, kitchen).
 */
export function useApi<T>(url: string | null, opts: { refreshMs?: number } = {}): ApiState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const current = useRef(url);
  current.current = url;

  const load = useCallback(
    async (quiet = false) => {
      if (!url) return;
      if (!quiet) setLoading(true);
      try {
        const d = await apiFetch<T>(url);
        if (current.current === url) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (current.current === url && (e as Error).name !== "AbortError") setError(e as ClientApiError);
      } finally {
        if (current.current === url) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!url || !opts.refreshMs) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const t = setInterval(tick, opts.refreshMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, opts.refreshMs, load]);

  return {
    data,
    error,
    loading: loading && data === undefined,
    reload: () => load(true),
    setData: (d) => setData((prev) => (typeof d === "function" ? (d as (p: T | undefined) => T)(prev) : d)),
  };
}

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
