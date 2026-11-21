import "server-only";
import { q } from "./db";

/**
 * Kitchen feed: open orders with items, notes and table — never prices or phone numbers —
 * plus orders that became ready/served in the last 20 minutes. Pre-orders stay "held"
 * until 15 minutes before their pickup time.
 */
export async function kitchenFeed() {
  const { rows } = await q<Record<string, unknown> & { scheduled_for: string | null }>(
    `select o.id, o.number, o.type, o.status, o.notes, o.customer_name, o.created_at, o.accepted_at, o.preparing_at, o.ready_at, o.served_at, o.completed_at,
            o.scheduled_for, t.label as table_label,
            coalesce((select json_agg(json_build_object('name', i.name, 'variant', i.variant_name, 'qty', i.qty, 'modifiers', i.modifiers, 'notes', i.notes) order by i.id)
                        from order_items i where i.order_id = o.id and i.menu_item_id is not null), '[]') as items
       from orders o left join dining_tables t on t.id = o.table_id
      where o.status in ('new','accepted','preparing','ready')
         or (o.status in ('served','completed') and coalesce(o.completed_at, o.served_at, o.ready_at) > now() - interval '20 minutes')
      order by coalesce(o.scheduled_for - interval '15 minutes', o.created_at)`,
  );
  const now = Date.now();
  return {
    orders: rows.map((r) => ({ ...r, held: !!r.scheduled_for && new Date(r.scheduled_for).getTime() - 15 * 60000 > now })),
    at: new Date().toISOString(),
  };
}
