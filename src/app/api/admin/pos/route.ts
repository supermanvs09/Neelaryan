import { api } from "@/server/http";
import { q } from "@/server/db";
import { loadMenu, publicMenuPayload } from "@/server/menu";
import { getSetting } from "@/server/settings";
import { listTables } from "@/server/tables";

/** Everything the counter screen needs in one request. */
export const GET = api(
  async () => {
    const [menu, tax, tables, products] = await Promise.all([
      loadMenu("public"),
      getSetting("tax"),
      listTables(),
      q<{ id: string; name: string; sell_unit_name: string; sell_unit_qty: number; base_unit: string; stock_qty: number; retail_price: number | null; wholesale_price: number | null; category: string | null }>(
        `select i.id, i.name, i.sell_unit_name, i.sell_unit_qty, i.base_unit, i.stock_qty, i.retail_price, i.wholesale_price, c.name as category
           from inventory_items i left join inventory_categories c on c.id = i.category_id
          where i.is_active and i.is_sellable order by c.name nulls last, i.name`,
      ),
    ]);
    return {
      ...publicMenuPayload(menu),
      tax,
      tables: tables.map((t) => ({ id: t.id, label: t.label, area: t.area, occupied: t.occupied })),
      products: products.rows.map((p) => ({ ...p, available: p.sell_unit_qty > 0 ? Math.floor(p.stock_qty / p.sell_unit_qty) : 0 })),
    };
  },
  { permission: "orders.create" },
);
