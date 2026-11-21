"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { billTotals, priceLine, round2 } from "@/lib/pricing";
import type { ShopMenu } from "./menu";

export interface CartLine {
  /** item + size + options + note — identical lines merge */
  key: string;
  item_id: string;
  variant_id: string | null;
  modifier_ids: string[];
  qty: number;
  notes?: string;
}

/** Orders placed from this device; the token proves it's ours when tracking (the server stores only its hash). */
export interface MyOrder {
  id: string;
  number: number;
  token: string;
  placed_at: number;
}

export type Mode = "dine_in" | "takeaway";

interface ShopState {
  mode: Mode | null;
  table: { token: string; label: string; name: string } | null;
  cart: CartLine[];
  contact: { name: string; phone: string };
  orders: MyOrder[];
  /** checkout attempt id: the same id is sent on retries so an order is never placed twice */
  checkoutKey: string | null;
  checkoutToken: string | null;
  setMode: (m: Mode) => void;
  setTable: (t: ShopState["table"]) => void;
  add: (l: Omit<CartLine, "key">) => void;
  replace: (key: string, l: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  setContact: (c: Partial<ShopState["contact"]>) => void;
  addOrder: (o: MyOrder) => void;
  /** idempotency key + device token for this checkout attempt (reused on retries) */
  newCheckoutKey: () => { key: string; token: string };
  resetCheckoutKey: () => void;
}

export const MAX_QTY = 50;
const lineKey = (l: Omit<CartLine, "key">) => JSON.stringify([l.item_id, l.variant_id, [...l.modifier_ids].sort(), (l.notes ?? "").trim()]);
/** RFC 4122 v4 — getRandomValues works on plain-http LAN addresses where randomUUID doesn't. */
function uuid() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 48 random characters for the order access token. */
export function newAccessToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      mode: null,
      table: null,
      cart: [],
      contact: { name: "", phone: "" },
      orders: [],
      checkoutKey: null,
      checkoutToken: null,
      setMode: (mode) => set({ mode }),
      setTable: (table) => set({ table, mode: table ? "dine_in" : get().mode }),
      add: (l) =>
        set((s) => {
          const key = lineKey(l);
          const ex = s.cart.find((x) => x.key === key);
          return {
            checkoutKey: null,
            cart: ex ? s.cart.map((x) => (x.key === key ? { ...x, qty: Math.min(MAX_QTY, x.qty + l.qty) } : x)) : [...s.cart, { ...l, key, qty: Math.min(MAX_QTY, l.qty) }],
          };
        }),
      replace: (old, l) =>
        set((s) => {
          const key = lineKey(l);
          const others = s.cart.filter((x) => x.key !== old);
          const dup = others.find((x) => x.key === key);
          if (dup) return { checkoutKey: null, cart: others.map((x) => (x.key === key ? { ...x, qty: Math.min(MAX_QTY, x.qty + l.qty) } : x)) };
          const at = s.cart.findIndex((x) => x.key === old);
          const next = [...others];
          next.splice(at < 0 ? next.length : at, 0, { ...l, key });
          return { checkoutKey: null, cart: next };
        }),
      setQty: (key, qty) => set((s) => ({ checkoutKey: null, cart: qty <= 0 ? s.cart.filter((x) => x.key !== key) : s.cart.map((x) => (x.key === key ? { ...x, qty: Math.min(MAX_QTY, qty) } : x)) })),
      clear: () => set({ cart: [], checkoutKey: null, checkoutToken: null }),
      setContact: (c) => set((s) => ({ contact: { ...s.contact, ...c } })),
      addOrder: (o) => set((s) => ({ orders: [o, ...s.orders.filter((x) => x.id !== o.id)].slice(0, 30) })),
      newCheckoutKey: () => {
        const key = get().checkoutKey ?? uuid();
        const token = get().checkoutToken ?? newAccessToken();
        set({ checkoutKey: key, checkoutToken: token });
        return { key, token };
      },
      resetCheckoutKey: () => set({ checkoutKey: null, checkoutToken: null }),
    }),
    { name: "neelaryan:shop:v2", storage: createJSONStorage(() => localStorage), skipHydration: true, version: 2 },
  ),
);

export function useShopHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const p = useShop.persist;
    if (p.hasHydrated()) setH(true);
    return p.onFinishHydration(() => setH(true));
  }, []);
  return h;
}

export interface PricedCartLine {
  line: CartLine;
  ok: boolean;
  error: string | null;
  name: string;
  detail: string;
  unit: number;
  total: number;
}

/** Prices the cart against the live menu with the same rules the server uses. */
export function priceCart(menu: ShopMenu | null, cart: CartLine[]) {
  const lines: PricedCartLine[] = cart.map((l) => {
    if (!menu) return { line: l, ok: false, error: null, name: "…", detail: "", unit: 0, total: 0 };
    const p = priceLine(menu, { item_id: l.item_id, variant_id: l.variant_id, modifier_ids: l.modifier_ids, qty: l.qty });
    if (!p.ok) return { line: l, ok: false, error: p.error, name: menu.items.find((i) => i.id === l.item_id)?.name ?? "Item no longer available", detail: "", unit: 0, total: 0 };
    const item = menu.items.find((i) => i.id === l.item_id)!;
    const changed = p.modifiers.filter((m) => !item.default_modifier_ids.includes(m.id)).map((m) => m.name);
    const detail = [p.variant?.name, ...changed, ...p.removed.map((r) => `no ${r.toLowerCase()}`)].filter(Boolean).join(" · ");
    return { line: l, ok: true, error: null, name: p.name, detail, unit: p.unitPrice, total: p.lineTotal };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const count = cart.reduce((s, l) => s + l.qty, 0);
  return { lines, subtotal, count, blocked: lines.some((l) => !l.ok) };
}

export function totalsFor(menu: ShopMenu | null, subtotal: number, discount: number) {
  return billTotals(subtotal, discount, menu?.tax ?? { gst_percent: 0, service_charge_percent: 0 });
}
