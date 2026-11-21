"use client";

import { create } from "zustand";

export interface Account {
  customer: { id: string; name: string; phone: string | null; email: string | null; dob: string | null; marketing_consent: boolean; points_balance: number; lifetime_points: number; visits: number; created_at: string };
  points: { balance: number; value: number; expiring: { points: number; expires_at: string } | null };
  loyalty: { enabled: boolean; points_per_100: number; point_value: number; min_redeem_points: number; max_redeem_percent: number; min_order_amount: number };
  history: { kind: string; points: number; note: string; created_at: string; expires_at: string | null }[];
  redemptions: { id: string; code: string; status: string; points: number; expires_at: string; used_at: string | null; created_at: string; name: string; description: string }[];
  rewards: { id: string; name: string; description: string; points_cost: number; kind: string; value: number | null; min_order: number; menu_item: string | null; left: number | null; valid_to: string | null }[];
  orders: { id: string; number: number; type: string; status: string; total: number; created_at: string; table_label: string | null; points_earned: number | null; items: string }[];
}

interface AccountState {
  data: Account | null;
  /** null = not checked yet */
  signedIn: boolean | null;
  loading: boolean;
  refresh: () => Promise<void>;
  set: (a: Account | null) => void;
  signOut: () => Promise<void>;
}

/** The signed-in customer (cookie session, 90 days) — or none. */
export const useAccount = create<AccountState>((set) => ({
  data: null,
  signedIn: null,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const r = await fetch("/api/public/me", { cache: "no-store" });
      const j = (await r.json()) as Account | { customer: null };
      if (j.customer) set({ data: j as Account, signedIn: true });
      else set({ data: null, signedIn: false });
    } catch {
      set((s) => ({ signedIn: s.signedIn ?? false }));
    } finally {
      set({ loading: false });
    }
  },
  set: (a) => set({ data: a, signedIn: !!a }),
  signOut: async () => {
    await fetch("/api/public/auth/logout", { method: "POST" }).catch(() => undefined);
    set({ data: null, signedIn: false });
  },
}));
