import "server-only";
import { q } from "./db";
import type { SoldItem, StockItem, Usage } from "@/lib/analytics";

const IST = (c: string) => `(${c} at time zone 'Asia/Kolkata')::date`;

/** Stock items (active) in the shape the shopping list and usage check need. */
export async function stockItems(): Promise<StockItem[]> {
  const { rows } = await q<StockItem>(
    `select i.id, i.name, i.base_unit, i.display_unit, i.stock_qty, i.min_qty, i.avg_cost, s.name as supplier
       from inventory_items i left join suppliers s on s.id = i.default_supplier_id where i.is_active order by i.name`,
  );
  return rows.map((r) => ({ ...r, stock_qty: Number(r.stock_qty), min_qty: Number(r.min_qty), avg_cost: r.avg_cost === null ? null : Number(r.avg_cost) }));
}

/**
 * What happened to each item between two dates:
 *  sold = order consumption net of cancellations; used = corrections that removed stock;
 *  wasted = wastage; count_difference = what physical counts added/removed.
 */
export async function ingredientUsage(from: string, to: string): Promise<Usage[]> {
  const { rows } = await q<{ item_id: string; sold: number; used: number; wasted: number; count_difference: number; counts: number; first_movement_at: string | null }>(
    `select m.item_id,
            coalesce(-sum(m.qty) filter (where m.kind in ('sale','sale_return')), 0) as sold,
            coalesce(-sum(m.qty) filter (where m.kind = 'adjustment' and m.qty < 0), 0) as used,
            coalesce(-sum(m.qty) filter (where m.kind = 'wastage'), 0) as wasted,
            coalesce(sum(m.qty) filter (where m.kind = 'count'), 0) as count_difference,
            count(*) filter (where m.kind = 'count')::int as counts,
            (select min(x.created_at) from stock_movements x where x.item_id = m.item_id) as first_movement_at
       from stock_movements m
      where ${IST("m.created_at")} between $1 and $2
      group by m.item_id`,
    [from, to],
  );
  return rows.map((r) => ({ ...r, sold: Math.max(0, Number(r.sold)), used: Number(r.used), wasted: Number(r.wasted), count_difference: Number(r.count_difference) }));
}

/** Menu items sold (completed orders) with their recorded costs, plus available items that didn't sell. */
export async function menuSales(from: string, to: string) {
  const [sold, unsold] = await Promise.all([
    q<{ menu_item_id: string | null; name: string; qty: number; sales: number; cost: number | null; uncosted: number }>(
      `select i.menu_item_id, min(i.name) as name, sum(i.qty)::int as qty, sum(i.line_total) as sales,
              sum(i.qty * i.unit_cost) as cost, count(*) filter (where i.unit_cost is null)::int as uncosted
         from order_items i join orders o on o.id = i.order_id
        where o.status = 'completed' and i.menu_item_id is not null and ${IST("o.completed_at")} between $1 and $2
        group by i.menu_item_id`,
      [from, to],
    ),
    q<{ menu_item_id: string; name: string; price: number; unit_cost: number | null }>(
      `select m.id as menu_item_id, m.name, coalesce((select v.price from item_variants v where v.item_id = m.id and v.is_default and v.is_active limit 1), m.price) as price,
              coalesce((select sum(r.qty * inv.avg_cost) from recipe_lines r join inventory_items inv on inv.id = r.inventory_item_id where r.menu_item_id = m.id
                         having count(*) = count(inv.avg_cost)), m.cost_price) as unit_cost
         from menu_items m
        where m.is_active and m.status = 'available'
          and not exists (select 1 from order_items i join orders o on o.id = i.order_id
                           where i.menu_item_id = m.id and o.status = 'completed' and ${IST("o.completed_at")} between $1 and $2)`,
      [from, to],
    ),
  ]);
  return {
    sold: sold.rows.map((r) => ({ menu_item_id: r.menu_item_id, name: r.name, qty: r.qty, sales: Number(r.sales), cost: r.uncosted ? null : Number(r.cost ?? 0) })) as SoldItem[],
    unsold: unsold.rows.map((r) => ({ menu_item_id: r.menu_item_id, name: r.name, price: Number(r.price), unitCost: r.unit_cost === null ? null : Number(r.unit_cost) })),
  };
}

/** Orders and discount given per offer over a period. */
export async function offerStats(from: string, to: string) {
  const { rows } = await q<{ offer_id: string; orders: number; units: number; discount: number }>(
    `select i.offer_id, count(distinct i.order_id)::int as orders, sum(i.qty)::int as units, sum(i.qty * i.discount) as discount
       from order_items i join orders o on o.id = i.order_id
      where i.offer_id is not null and o.status not in ('cancelled','rejected') and ${IST("o.created_at")} between $1 and $2
      group by i.offer_id`,
    [from, to],
  );
  return new Map(rows.map((r) => [r.offer_id, { orders: r.orders, units: r.units, discount: Number(r.discount) }]));
}
