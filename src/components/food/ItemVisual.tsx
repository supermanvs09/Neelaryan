"use client";

import { memo } from "react";
import type { MenuItem } from "@/data/menu";
import { recipeFor, SHAKE_GARNISH, type IngredientId, type Selection } from "@/data/builders";
import { BowlScene } from "./BowlScene";
import { GlassScene } from "./GlassScene";
import { FoodArt } from "./FoodArt";
import { clsx } from "@/lib/clsx";

export const selectionIngredients = (sel: Selection): IngredientId[] =>
  Object.values(sel)
    .flat()
    .filter((id) => id !== "no-protein");

/**
 * The picture for a menu item: oats bowls and shakes are assembled live from
 * their real recipe (layered cut-outs); everything else uses tinted artwork
 * until product photography is supplied.
 */
export const ItemVisual = memo(function ItemVisual({
  item,
  selection,
  animate = false,
  className,
}: {
  item: MenuItem;
  selection?: Selection;
  animate?: boolean;
  className?: string;
}) {
  if (item.customizer === "oats-builder") {
    const sel = selection ?? recipeFor("oats", item.id);
    return (
      <div className={clsx("flex items-center justify-center", className)}>
        <BowlScene ingredients={selectionIngredients(sel)} animate={animate} label={item.name} />
      </div>
    );
  }
  if (item.customizer === "shake-builder") {
    const sel = selection ?? recipeFor("shake", item.id);
    return (
      <div className={clsx("flex items-center justify-center", className)}>
        <GlassScene ingredients={selectionIngredients(sel)} flavour={item.tint[0]} garnish={SHAKE_GARNISH[item.id] ?? "none"} animate={animate} label={item.name} className="max-w-[78%]" />
      </div>
    );
  }
  return (
    <div className={clsx("flex items-center justify-center", className)} role="img" aria-label={item.name}>
      <FoodArt kind={item.art} tint={item.tint} className="h-full max-h-full w-full max-w-full" />
    </div>
  );
});
