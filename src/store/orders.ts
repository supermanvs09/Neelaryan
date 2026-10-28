"use client";

import { create } from "zustand";
import type { Order, OrderMode, OrderStatus, PaymentStatus } from "./types";

/**
 * Orders are shared between the customer app and the Staff KDS. Until the
 * Supabase backend lands, they live in localStorage and every mutation does a
 * fresh read → modify → write so two open tabs never overwrite each other.
 * Other tabs pick changes up through the `storage` event.
 */

export const ORDERS_KEY = "neelaryan:orders:v1";
export const KDS_HEARTBEAT_KEY = "neelaryan:kds-heartbeat";

function read(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(orders: Order[]) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    /* storage full or blocked — state still lives in memory */
  }
}

/** The lifecycle each order type walks through. */
export function flowFor(mode: OrderMode): OrderStatus[] {
  const handoff: OrderStatus = mode === "delivery" ? "OUT_FOR_DELIVERY" : "SERVED";
  return ["NEW", "ACCEPTED", "PREPARING", "READY", handoff, "COMPLETED"];
}

export function nextStatus(order: Order): OrderStatus | null {
  const flow = flowFor(order.mode);
  const i = flow.indexOf(order.status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

export const isActive = (o: Order) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(o.status);

interface OrdersState {
  orders: Order[];
  hydrated: boolean;
  sync: () => void;
  add: (order: Order) => void;
  setStatus: (id: string, status: OrderStatus) => void;
  setPayment: (id: string, status: PaymentStatus) => void;
}

export const useOrders = create<OrdersState>((set) => {
  const mutate = (fn: (orders: Order[]) => Order[]) => {
    const next = fn(read());
    write(next);
    set({ orders: next });
  };

  return {
    orders: [],
    hydrated: false,
    sync: () => set({ orders: read(), hydrated: true }),
    add: (order) => mutate((all) => [order, ...all.filter((o) => o.id !== order.id)]),
    setStatus: (id, status) =>
      mutate((all) =>
        all.map((o) => {
          if (o.id !== id || o.status === status) return o;
          const at = Date.now();
          return {
            ...o,
            status,
            history: [...o.history, { status, at }],
            completedAt: status === "COMPLETED" ? at : o.completedAt,
          };
        }),
      ),
    setPayment: (id, status) =>
      mutate((all) => all.map((o) => (o.id === id ? { ...o, payment: { ...o.payment, status } } : o))),
  };
});

export function newOrderId(existing: Order[]) {
  const max = existing.reduce((m, o) => {
    const n = Number(o.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1041);
  return `NEEL${max + 1}`;
}

/** Fresh read straight from storage (used right before creating an order). */
export const readOrders = read;
