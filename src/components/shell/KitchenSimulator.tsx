"use client";

import { useEffect } from "react";
import { KDS_HEARTBEAT_KEY, isActive, nextStatus, useOrders } from "@/store/orders";
import type { OrderStatus } from "@/store/types";

/**
 * DEMO ONLY — until the Supabase backend is connected, nobody else moves an
 * order forward. If no Staff KDS tab is open, this simulates the kitchen so the
 * live tracking can be experienced end-to-end. With /staff open, staff drive it.
 */
const STEP_SECONDS: Partial<Record<OrderStatus, number>> = {
  NEW: 6,
  ACCEPTED: 5,
  PREPARING: 20,
  READY: 10,
  SERVED: 10,
  OUT_FOR_DELIVERY: 14,
};

export const kdsOnline = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KDS_HEARTBEAT_KEY) ?? 0) < 8000;
  } catch {
    return false;
  }
};

export function KitchenSimulator() {
  useEffect(() => {
    const tick = () => {
      if (kdsOnline()) return;
      const { orders, setStatus, setPayment } = useOrders.getState();
      const now = Date.now();
      for (const o of orders) {
        if (!isActive(o) || now - o.createdAt > 2 * 3600_000) continue;
        const last = o.history[o.history.length - 1]?.at ?? o.createdAt;
        const wait = (STEP_SECONDS[o.status] ?? 8) * 1000;
        if (now - last < wait) continue;
        const next = nextStatus(o);
        if (!next) continue;
        if (next === "COMPLETED" && o.payment.status !== "PAID") setPayment(o.id, "PAID");
        setStatus(o.id, next);
      }
    };
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);
  return null;
}
