"use client";

import { create } from "zustand";

export interface FlyEvent {
  id: number;
  from: DOMRect;
  color: string;
  src?: string;
}

interface UIState {
  cartOpen: boolean;
  toast: { id: number; text: string; tone: "ok" | "warn" } | null;
  fly: FlyEvent[];
  cartPulse: number;
  product: string | null;
  openProduct: (id: string) => void;
  closeProduct: () => void;
  openCart: () => void;
  closeCart: () => void;
  showToast: (text: string, tone?: "ok" | "warn") => void;
  dismissToast: () => void;
  flyToCart: (from: DOMRect, color: string, src?: string) => void;
  landFly: (id: number) => void;
}

let seq = 0;

export const useUI = create<UIState>((set) => ({
  cartOpen: false,
  toast: null,
  fly: [],
  cartPulse: 0,
  product: null,
  openProduct: (id) => set({ product: id }),
  closeProduct: () => set({ product: null }),
  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),
  showToast: (text, tone = "ok") => set({ toast: { id: ++seq, text, tone } }),
  dismissToast: () => set({ toast: null }),
  flyToCart: (from, color, src) => set((s) => ({ fly: [...s.fly, { id: ++seq, from, color, src }] })),
  landFly: (id) => set((s) => ({ fly: s.fly.filter((f) => f.id !== id), cartPulse: s.cartPulse + 1 })),
}));
