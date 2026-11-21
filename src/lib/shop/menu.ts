"use client";

import { create } from "zustand";
import { priceLine, type PricingMenu } from "@/lib/pricing";
import { bestOffer, cafeClock, discountFor, type Offer } from "@/lib/offers";

/** Shapes returned by GET /api/menu (public, no costs). */
export interface ShopModifier {
  id: string;
  name: string;
  price: number;
  visual_key: string | null;
}
export interface ShopGroup {
  id: string;
  name: string;
  description: string;
  selection: "single" | "multi";
  min_select: number;
  max_select: number | null;
  modifiers: ShopModifier[];
}
export interface ShopItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  diet: "veg" | "egg" | "nonveg";
  tags: string[];
  image: string | null;
  art_kind: string;
  tint: string[];
  visual: "art" | "bowl" | "glass";
  status: "available" | "sold_out";
  is_featured: boolean;
  variants: { id: string; name: string; price: number; is_default: boolean }[];
  group_ids: string[];
  default_modifier_ids: string[];
  /** ready-made items: portions left (null = not stock-tracked) */
  stock_left: number | null;
}
export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  art_kind: string;
}
export interface ShopMenu extends PricingMenu {
  categories: ShopCategory[];
  items: ShopItem[];
  groups: ShopGroup[];
  ordering: { accepting_orders: boolean; takeaway_enabled: boolean; closed_message: string; preorders_enabled: boolean; show_wait_time: boolean };
  payments: { cash: boolean; upi: boolean; upi_id: string | null; upi_payee_name: string };
  push_key: string | null;
  offers: Offer[];
  tax: { gst_percent: number; service_charge_percent: number };
  business: { name: string; tagline: string };
  loyalty: { enabled: boolean; points_per_100: number; min_order_amount: number; point_value: number; min_redeem_points: number; max_redeem_percent: number };
}

interface MenuState {
  menu: ShopMenu | null;
  error: string | null;
  loading: boolean;
  loadedAt: number;
  load: (force?: boolean) => Promise<void>;
}

/** The live menu. Re-fetched when stale so sold-out items and price changes show quickly. */
export const useMenu = create<MenuState>((set, get) => ({
  menu: null,
  error: null,
  loading: false,
  loadedAt: 0,
  load: async (force = false) => {
    if (get().loading) return;
    if (!force && get().menu && Date.now() - get().loadedAt < 60_000) return;
    set({ loading: true });
    try {
      const r = await fetch("/api/menu", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn't load the menu.");
      set({ menu: (await r.json()) as ShopMenu, error: null, loadedAt: Date.now() });
    } catch (e) {
      set({ error: e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. Check your connection and try again." });
    } finally {
      set({ loading: false });
    }
  },
}));

export const itemBySlug = (m: ShopMenu, slug: string) => m.items.find((i) => i.slug === slug);
export const itemById = (m: ShopMenu, id: string) => m.items.find((i) => i.id === id);
export const groupsFor = (m: ShopMenu, item: ShopItem) => item.group_ids.map((g) => m.groups.find((x) => x.id === g)).filter((g): g is ShopGroup => !!g);
export const isBuilder = (item: ShopItem) => item.visual === "bowl" || item.visual === "glass";
export const fromPrice = (item: ShopItem) => (item.variants.length ? Math.min(...item.variants.map((v) => v.price)) : item.price);

/** Starting selection for an item: its recipe defaults (and the default size). */
export function defaultSelection(m: ShopMenu, item: ShopItem) {
  const ids = new Set(groupsFor(m, item).flatMap((g) => g.modifiers.map((x) => x.id)));
  return {
    variant_id: item.variants.find((v) => v.is_default)?.id ?? item.variants[0]?.id ?? null,
    modifier_ids: item.default_modifier_ids.filter((id) => ids.has(id)),
  };
}

/** Visual keys of the chosen options (what the bowl / glass scenes draw). */
export function visualKeys(m: ShopMenu, item: ShopItem, modifierIds: string[]) {
  const chosen = new Set(modifierIds);
  return groupsFor(m, item)
    .flatMap((g) => g.modifiers)
    .filter((x) => chosen.has(x.id) && x.visual_key)
    .map((x) => x.visual_key!);
}

export { priceLine };

/** The offer an item gets right now (for strike-through prices on the menu). */
export function itemOffer(m: ShopMenu, item: ShopItem, at = new Date()) {
  const o = bestOffer(item.id, m.offers ?? [], cafeClock(at));
  if (!o) return null;
  const base = fromPrice(item);
  const off = discountFor(base, o.percent_off);
  return off > 0 ? { offer: o, price: base - off, was: base } : null;
}
