import { api } from "@/server/http";
import { q } from "@/server/db";
import { loadMenu, imageUrl } from "@/server/menu";

/** Everything the menu editor needs, including costs and recipes (staff only). */
export const GET = api(
  async () => {
    const [menu, recipes, modRecipes, inventory] = await Promise.all([
      loadMenu("admin"),
      q<{ menu_item_id: string; inventory_item_id: string; qty: number }>("select menu_item_id, inventory_item_id, qty from recipe_lines"),
      q<{ modifier_id: string; inventory_item_id: string; qty: number }>("select modifier_id, inventory_item_id, qty from modifier_recipe_lines"),
      q<{ id: string; name: string; base_unit: string; display_unit: string; avg_cost: number | null }>("select id, name, base_unit, display_unit, avg_cost from inventory_items where is_active order by lower(name)"),
    ]);
    const modCost = await q<{ id: string; cost_price: number | null }>("select id, cost_price from modifiers");
    return {
      ...menu,
      items: menu.items.map((i) => ({
        ...i,
        image: imageUrl(i.image_id),
        recipe: recipes.rows.filter((r) => r.menu_item_id === i.id).map(({ inventory_item_id, qty }) => ({ inventory_item_id, qty })),
      })),
      groups: menu.groups.map((g) => ({
        ...g,
        modifiers: g.modifiers.map((m) => ({
          ...m,
          cost_price: modCost.rows.find((c) => c.id === m.id)?.cost_price ?? null,
          recipe: modRecipes.rows.filter((r) => r.modifier_id === m.id).map(({ inventory_item_id, qty }) => ({ inventory_item_id, qty })),
        })),
      })),
      inventory: inventory.rows,
    };
  },
  { permission: "menu.view" },
);
