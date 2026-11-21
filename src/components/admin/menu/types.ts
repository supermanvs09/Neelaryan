export interface AdminModifier {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  visual_key: string | null;
  is_active: boolean;
  sort: number;
  recipe: { inventory_item_id: string; qty: number }[];
}
export interface AdminGroup {
  id: string;
  name: string;
  description: string;
  selection: "single" | "multi";
  min_select: number;
  max_select: number | null;
  is_active: boolean;
  sort: number;
  modifiers: AdminModifier[];
}
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  art_kind: string;
  sort: number;
  is_active: boolean;
}
export interface AdminItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  cost_price: number | null;
  diet: "veg" | "egg" | "nonveg";
  tags: string[];
  image_id: string | null;
  image: string | null;
  art_kind: string;
  tint: string[];
  visual: "art" | "bowl" | "glass";
  status: "available" | "sold_out" | "hidden";
  is_featured: boolean;
  sort: number;
  variants: { id: string; name: string; price: number; cost_price: number | null; is_default: boolean; is_active: boolean }[];
  group_ids: string[];
  default_modifier_ids: string[];
  recipe: { inventory_item_id: string; qty: number }[];
  /** ready-made: sold straight from this stock item, one unit per portion */
  stock_item_id: string | null;
  stock_left?: number | null;
}
export interface InvOption {
  id: string;
  name: string;
  base_unit: string;
  display_unit: string;
  avg_cost: number | null;
}
export interface AdminMenu {
  categories: AdminCategory[];
  items: AdminItem[];
  groups: AdminGroup[];
  inventory: InvOption[];
}

export const STATUS_LABEL = { available: "Available", sold_out: "Sold out", hidden: "Hidden" } as const;
export const TAGS = ["bestseller", "new", "healthy", "protein", "spicy", "recommended"] as const;
export const TAG_LABEL: Record<string, string> = { bestseller: "Bestseller", new: "New", healthy: "Healthy", protein: "Protein rich", spicy: "Spicy", recommended: "Recommended" };

/** Ingredient cost of a recipe (null when any ingredient has no known cost). */
export function recipeCost(recipe: { inventory_item_id: string; qty: number }[], inv: InvOption[]) {
  if (!recipe.length) return null;
  let sum = 0;
  for (const r of recipe) {
    const i = inv.find((x) => x.id === r.inventory_item_id);
    if (!i || i.avg_cost === null) return null;
    sum += r.qty * Number(i.avg_cost);
  }
  return sum;
}
