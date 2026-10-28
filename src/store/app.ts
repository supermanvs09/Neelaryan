"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { COUPONS, couponDiscount, GST_RATE } from "@/data/config";
import type { CartLine, Customer, OrderMode } from "./types";

interface AppState {
  /** null until the guest picks Dine In / Order Online. */
  mode: OrderMode | null;
  table: string | null;
  cart: CartLine[];
  couponCode: string | null;
  profile: Customer | null;
  address: string;
  favourites: string[];
  rewardsRedeemed: number;
  notifications: boolean;
  offers: boolean;

  setMode: (mode: OrderMode, table?: string | null) => void;
  setTable: (table: string | null) => void;
  addLine: (line: CartLine) => void;
  replaceLine: (key: string, line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string | null) => void;
  saveProfile: (p: Customer) => void;
  setAddress: (a: string) => void;
  toggleFavourite: (id: string) => void;
  redeemReward: () => void;
  setPref: (k: "notifications" | "offers", v: boolean) => void;
}

const MAX_QTY = 20;

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      mode: null,
      table: null,
      cart: [],
      couponCode: null,
      profile: null,
      address: "",
      favourites: [],
      rewardsRedeemed: 0,
      notifications: true,
      offers: true,

      setMode: (mode, table) => set((s) => ({ mode, table: mode === "dine-in" ? (table ?? s.table) : s.table })),
      setTable: (table) => set({ table }),
      addLine: (line) =>
        set((s) => {
          const existing = s.cart.find((l) => l.key === line.key);
          if (existing)
            return {
              cart: s.cart.map((l) => (l.key === line.key ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l)),
            };
          return { cart: [...s.cart, { ...line, qty: Math.min(MAX_QTY, line.qty) }] };
        }),
      replaceLine: (key, line) =>
        set((s) => {
          const others = s.cart.filter((l) => l.key !== key);
          const dup = others.find((l) => l.key === line.key);
          if (dup)
            return {
              cart: others.map((l) => (l.key === line.key ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l)),
            };
          const idx = s.cart.findIndex((l) => l.key === key);
          const next = [...others];
          next.splice(idx < 0 ? next.length : idx, 0, line);
          return { cart: next };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          cart:
            qty <= 0
              ? s.cart.filter((l) => l.key !== key)
              : s.cart.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
        })),
      removeLine: (key) => set((s) => ({ cart: s.cart.filter((l) => l.key !== key) })),
      clearCart: () => set({ cart: [], couponCode: null }),
      applyCoupon: (couponCode) => set({ couponCode }),
      saveProfile: (profile) => set({ profile }),
      setAddress: (address) => set({ address }),
      toggleFavourite: (id) =>
        set((s) => ({
          favourites: s.favourites.includes(id) ? s.favourites.filter((f) => f !== id) : [...s.favourites, id],
        })),
      redeemReward: () => set((s) => ({ rewardsRedeemed: s.rewardsRedeemed + 1 })),
      setPref: (k, v) => set({ [k]: v } as Pick<AppState, typeof k>),
    }),
    {
      name: "neelaryan:app:v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      version: 1,
    },
  ),
);

export const MAX_LINE_QTY = MAX_QTY;

export function cartTotals(cart: CartLine[], couponCode: string | null) {
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const coupon = couponCode ? COUPONS.find((c) => c.code === couponCode) : undefined;
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  const tax = Math.round((subtotal - discount) * GST_RATE);
  const total = subtotal - discount + tax;
  const count = cart.reduce((s, l) => s + l.qty, 0);
  return { subtotal, discount, tax, total, count, coupon, couponValid: !coupon || discount > 0 };
}
