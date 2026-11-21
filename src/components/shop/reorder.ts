"use client";

import { priceLine, type ShopMenu } from "@/lib/shop/menu";
import { useShop } from "@/lib/shop/store";

export interface PastItem {
  menu_item_id: string | null;
  variant_id: string | null;
  modifiers: { id: string; name: string; group: string }[];
  qty: number;
  notes: string;
}

/**
 * "Order again": puts a past order's dishes back in the cart with the same size and
 * options. Anything sold out, removed from the menu, or whose options changed is skipped.
 */
export function reorder(menu: ShopMenu, items: PastItem[]) {
  let added = 0;
  let skipped = 0;
  const add = useShop.getState().add;
  for (const it of items) {
    if (!it.menu_item_id) {
      skipped++;
      continue;
    }
    // stored lines list every chosen option (kept recipe defaults included); "No …" removals carry no id
    const modifier_ids = it.modifiers.filter((m) => m.id && m.group !== "removed").map((m) => m.id);
    const line = { item_id: it.menu_item_id, variant_id: it.variant_id, modifier_ids, qty: it.qty, notes: it.notes || undefined };
    const p = priceLine(menu, line);
    if (!p.ok) {
      skipped++;
      continue;
    }
    add(line);
    added++;
  }
  return { added, skipped };
}
