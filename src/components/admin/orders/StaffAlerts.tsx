"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button, useToast } from "../ui";
import { apiFetch, qs } from "@/lib/api-client";
import { subscribe, pushSupported } from "@/lib/shop/push";

/** Lock-screen alerts for new orders, UPI payments and table requests on this device. */
export function StaffAlerts() {
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const ep = sub?.endpoint ?? null;
      setEndpoint(ep);
      const r = await apiFetch<{ key: string | null; subscribed: boolean }>(`/api/admin/push${qs({ endpoint: ep ?? undefined })}`).catch(() => null);
      setKey(r?.key ?? null);
      setOn(!!r?.subscribed);
    })();
  }, []);
  if (!key) return null; // not configured on the server (no VAPID keys) or not supported here

  const toggle = async () => {
    setBusy(true);
    try {
      if (on && endpoint) {
        await apiFetch("/api/admin/push", { method: "DELETE", body: { endpoint } });
        setOn(false);
        toast("Alerts off on this device");
        return;
      }
      const r = await subscribe(key);
      if (!r.ok) return toast(r.reason === "denied" ? "Notifications are blocked for this site in the browser settings." : r.reason === "install" ? "On iPhone, add this site to the Home Screen first." : "This browser can't show notifications.", "error");
      await apiFetch("/api/admin/push", { method: "POST", body: { subscription: r.sub } });
      setEndpoint(r.sub.endpoint ?? null);
      setOn(true);
      toast("Alerts on for this device");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" size="sm" icon={<BellRing size={15} />} loading={busy} onClick={toggle} aria-pressed={on}>
      Phone alerts {on ? "on" : "off"}
    </Button>
  );
}
