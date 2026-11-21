import { api } from "@/server/http";
import { q } from "@/server/db";

/**
 * Kitchen feed: open orders with items, notes and table — no prices or phone
 * numbers. Plus orders that became ready/served in the last 20 minutes.
 */
export const GET = api(
  async () => {
    const { rows } = await q(
      `select o.id, o.number, o.type, o.status, o.notes, o.customer_name, o.created_at, o.accepted_at, o.preparing_at, o.ready_at, o.served_at, o.completed_at,
              t.label as table_label,
              coalesce((select json_agg(json_build_object('name', i.name, 'variant', i.variant_name, 'qty', i.qty, 'modifiers', i.modifiers, 'notes', i.notes) order by i.id)
                          from order_items i where i.order_id = o.id and i.menu_item_id is not null), '[]') as items
         from orders o left join dining_tables t on t.id = o.table_id
        where o.status in ('new','accepted','preparing','ready')
           or (o.status in ('served','completed') and coalesce(o.completed_at, o.served_at, o.ready_at) > now() - interval '20 minutes')
        order by o.created_at`,
    );
    return { orders: rows, at: new Date().toISOString() };
  },
  { permission: "kitchen.view" },
);
