"use client";

import { ProductImage, kindOf } from "@/components/ProductImage";
import type { ShopItem } from "@/lib/shop/menu";

/** A menu item's picture: its photo, or a plain category tile. */
export function ItemVisual({ item, className, iconSize }: { item: ShopItem; className?: string; iconSize?: number }) {
  return <ProductImage image={item.image} kind={kindOf(item)} name={item.name} className={className} iconSize={iconSize} />;
}
