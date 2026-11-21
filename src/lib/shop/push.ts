"use client";

/** Browser side of web push (works with the screen locked; iPhone needs "Add to Home Screen"). */

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIos = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
export const needsInstall = () => isIos() && !isStandalone();

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks permission (from a tap) and returns the subscription JSON, or a reason it can't. */
export async function subscribe(publicKey: string): Promise<{ ok: true; sub: PushSubscriptionJSON } | { ok: false; reason: "unsupported" | "denied" | "install" | "error" }> {
  if (needsInstall()) return { ok: false, reason: "install" };
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
    return { ok: true, sub: sub.toJSON() };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** UPI deep link per NPCI's UPI linking spec. */
export function upiLink(vpa: string, payee: string, amount: number, note: string) {
  const params: [string, string][] = [
    ["pa", vpa],
    ["pn", payee],
    ["am", amount.toFixed(2)],
    ["cu", "INR"],
    ["tn", note],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
