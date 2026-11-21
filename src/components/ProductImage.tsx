import { memo } from "react";
import { Coffee, CupSoda, CakeSlice, Egg, GlassWater, IceCreamCone, Milk, Salad, Sandwich, Soup, UtensilsCrossed, Wheat, type LucideIcon } from "lucide-react";
import { clsx } from "@/lib/clsx";

const ICONS: Record<string, LucideIcon> = {
  tea: Coffee,
  coffee: Coffee,
  iced: GlassWater,
  soda: CupSoda,
  shake: Milk,
  oats: Wheat,
  chaat: Salad,
  eggs: Egg,
  omelette: Egg,
  sandwich: Sandwich,
  wrap: Sandwich,
  rice: Soup,
  icecream: IceCreamCone,
  dessert: CakeSlice,
};

/**
 * Product picture: the uploaded photo when there is one; otherwise a plain,
 * neutral tile with the category's icon. No illustration, no animation.
 */
export const ProductImage = memo(function ProductImage({
  image,
  kind,
  name,
  className,
  iconSize = 28,
}: {
  image: string | null;
  kind: string;
  name: string;
  className?: string;
  iconSize?: number;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} loading="lazy" className={clsx("h-full w-full bg-surface-2 object-cover", className)} />;
  }
  const Icon = ICONS[kind] ?? UtensilsCrossed;
  return (
    <div className={clsx("grid h-full w-full place-items-center bg-surface-2 text-muted", className)} role="img" aria-label={name}>
      <Icon size={iconSize} strokeWidth={1.5} aria-hidden />
    </div>
  );
});

/** The icon family for a menu item (build-your-own bowls and shakes have their own). */
export const kindOf = (item: { visual: string; art_kind: string }) => (item.visual === "bowl" ? "oats" : item.visual === "glass" ? "shake" : item.art_kind);
