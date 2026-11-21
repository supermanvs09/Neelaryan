"use client";

import { memo } from "react";
import { BowlScene } from "@/components/food/BowlScene";
import { GlassScene } from "@/components/food/GlassScene";
import { FoodArt } from "@/components/food/FoodArt";
import { SHAKE_GARNISH, type IngredientId } from "@/data/builders";
import type { ArtKind } from "@/data/menu";
import type { ShopItem } from "@/lib/shop/menu";
import { clsx } from "@/lib/clsx";

const ARTS = new Set(["tea", "coffee", "soda", "iced", "chaat", "eggs", "omelette", "sandwich", "wrap", "rice", "oats", "shake", "icecream"]);

/**
 * The picture for a menu item: an uploaded photo if there is one; oats bowls and
 * shakes are assembled from their actual chosen ingredients; everything else
 * uses the café's illustrated artwork, tinted per item.
 */
export const ItemVisual = memo(function ItemVisual({ item, keys, animate = false, className, photoFit = "cover" }: { item: ShopItem; keys?: string[]; animate?: boolean; className?: string; photoFit?: "cover" | "contain" }) {
  if (item.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.image} alt={item.name} loading="lazy" className={clsx("h-full w-full", photoFit === "cover" ? "object-cover" : "object-contain", className)} />
    );
  }
  const ingredients = ((keys ?? []).filter((k) => k !== "no-protein") as IngredientId[]);
  if (item.visual === "bowl") {
    return (
      <div className={clsx("flex items-center justify-center", className)}>
        <BowlScene ingredients={ingredients} animate={animate} label={item.name} />
      </div>
    );
  }
  if (item.visual === "glass") {
    return (
      <div className={clsx("flex items-center justify-center", className)}>
        <GlassScene ingredients={ingredients} flavour={item.tint[0] ?? "#c98b5a"} garnish={SHAKE_GARNISH[item.slug] ?? "none"} animate={animate} label={item.name} className="max-w-[78%]" />
      </div>
    );
  }
  const kind = (ARTS.has(item.art_kind) ? item.art_kind : "coffee") as ArtKind;
  const tint: [string, string] = [item.tint[0] ?? "#b58a45", item.tint[1] ?? item.tint[0] ?? "#dbc7ac"];
  return (
    <div className={clsx("flex items-center justify-center", className)} role="img" aria-label={item.name}>
      <FoodArt kind={kind} tint={tint} className="h-full max-h-full w-full max-w-full" />
    </div>
  );
});
