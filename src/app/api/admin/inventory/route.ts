import { api, body } from "@/server/http";
import { q, tx } from "@/server/db";
import { InvItemSchema, listInventory, saveInventoryItem } from "@/server/inventory-admin";

/** Inventory with valuation, plus the lookups the screens need. */
export const GET = api(
  async (ctx) => {
    const all = ctx.req.nextUrl.searchParams.get("all") === "1";
    const [items, categories, suppliers] = await Promise.all([
      listInventory(null, { includeInactive: all }),
      q("select c.id, c.name, c.sort, (select count(*)::int from inventory_items i where i.category_id = c.id and i.is_active) as items from inventory_categories c order by c.sort, c.name"),
      q("select id, name from suppliers where is_active order by name"),
    ]);
    const active = items.filter((i) => i.is_active);
    return {
      items,
      categories: categories.rows,
      suppliers: suppliers.rows,
      summary: {
        count: active.length,
        value: active.reduce((s, i) => s + (i.value ?? 0), 0),
        unvalued: active.filter((i) => i.value === null && Number(i.stock_qty) > 0).length,
        low: active.filter((i) => i.low && !i.out).length,
        out: active.filter((i) => i.out).length,
        expiring: active.filter((i) => (i.expiring_qty ?? 0) > 0).length,
      },
    };
  },
  { permission: ["inventory.view", "menu.manage", "purchases.manage"] },
);

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, InvItemSchema);
    const id = await tx((t) => saveInventoryItem(t, ctx, null, input));
    return { id };
  },
  { permission: "inventory.manage" },
);
