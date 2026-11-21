"use client";

import { useMemo, useState } from "react";
import { defaultSelection, groupsFor, priceLine, type ShopGroup, type ShopItem, type ShopMenu } from "@/lib/shop/menu";

/** Option state for one item (size + options), with the same rules the server enforces. */
export function useSelection(menu: ShopMenu, item: ShopItem, initial?: { variant_id: string | null; modifier_ids: string[] }) {
  const start = initial ?? defaultSelection(menu, item);
  const [variant, setVariant] = useState<string | null>(start.variant_id);
  const [mods, setMods] = useState<string[]>(start.modifier_ids);
  const groups = useMemo(() => groupsFor(menu, item), [menu, item]);
  const [limitHit, setLimitHit] = useState<string | null>(null);

  const toggle = (g: ShopGroup, id: string) => {
    setLimitHit(null);
    setMods((cur) => {
      const inGroup = new Set(g.modifiers.map((m) => m.id));
      if (g.selection === "single") return [...cur.filter((x) => !inGroup.has(x)), id];
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      const count = cur.filter((x) => inGroup.has(x)).length;
      if (g.max_select !== null && count >= g.max_select) {
        setLimitHit(`You can pick up to ${g.max_select} ${g.name.replace(/^.*— /, "").toLowerCase()}. Remove one to add another.`);
        return cur;
      }
      return [...cur, id];
    });
  };
  const reset = () => {
    const d = defaultSelection(menu, item);
    setVariant(d.variant_id);
    setMods(d.modifier_ids);
    setLimitHit(null);
  };
  const price = (qty: number) => priceLine(menu, { item_id: item.id, variant_id: variant, modifier_ids: mods, qty });
  return { variant, setVariant, mods, toggle, reset, groups, price, limitHit };
}

/** What a choice costs relative to the recipe (matches lib/pricing). */
export function optionDelta(item: ShopItem, g: ShopGroup, modId: string) {
  const m = g.modifiers.find((x) => x.id === modId)!;
  if (g.selection === "single") {
    const def = g.modifiers.find((x) => item.default_modifier_ids.includes(x.id));
    return Math.max(0, m.price - (def?.price ?? 0));
  }
  return item.default_modifier_ids.includes(modId) ? 0 : m.price;
}

export const groupTitle = (g: ShopGroup) => g.name.replace(/^.*— /, "");
