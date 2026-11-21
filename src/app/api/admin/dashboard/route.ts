import { api, can } from "@/server/http";
import { q } from "@/server/db";

const IST = (col: string) => `(${col} at time zone 'Asia/Kolkata')`;
const TODAY = `(now() at time zone 'Asia/Kolkata')::date`;

/**
 * Live dashboard. Every number is computed from orders, payments, stock and customers right now.
 * Sales figures are only included for people allowed to see finance or reports.
 */
export const GET = api(
  async (ctx) => {
    const money = can(ctx.user, ["finance.view", "reports.view"]);
    const stock = can(ctx.user, ["inventory.view"]);

    const [live, tables, recent, sales, hourly, top, methods, lowStock, customers, supplierDue] = await Promise.all([
      q<{ status: string; n: number; late: number }>(
        `select status, count(*)::int as n, count(*) filter (where status in ('new','accepted','preparing') and created_at < now() - interval '15 minutes')::int as late
           from orders where status in ('new','accepted','preparing','ready','served') group by status`,
      ),
      q<{ total: number; occupied: number }>(
        `select count(*)::int as total, count(*) filter (where exists (select 1 from orders o where o.table_id = t.id and o.status in ('new','accepted','preparing','ready','served')))::int as occupied
           from dining_tables t where t.is_active`,
      ),
      q(
        `select o.id, o.number, o.type, o.status, o.payment_status, o.total, o.created_at, o.customer_name, t.label as table_label
           from orders o left join dining_tables t on t.id = o.table_id order by o.created_at desc limit 8`,
      ),
      money
        ? q<{ day: string; orders: number; revenue: number; gross: number; same_time: number; same_time_orders: number }>(
            // today vs yesterday, and yesterday up to the same time of day (fair comparison mid-day)
            `select d.day::text as day,
                    count(o.id) filter (where o.status = 'completed')::int as orders,
                    coalesce(sum(o.subtotal - o.discount + o.service_charge) filter (where o.status = 'completed'), 0) as revenue,
                    coalesce(sum(o.total) filter (where o.status = 'completed'), 0) as gross,
                    coalesce(sum(o.subtotal - o.discount + o.service_charge) filter (where o.status = 'completed' and ${IST("o.completed_at")}::time <= ${IST("now()")}::time), 0) as same_time,
                    count(o.id) filter (where o.status = 'completed' and ${IST("o.completed_at")}::time <= ${IST("now()")}::time)::int as same_time_orders
               from (select ${TODAY} as day union all select ${TODAY} - 1) d
               left join orders o on ${IST("o.completed_at")}::date = d.day
              group by d.day order by d.day desc`,
          )
        : null,
      money
        ? q<{ hour: number; revenue: number; orders: number }>(
            `select extract(hour from ${IST("completed_at")})::int as hour, sum(subtotal - discount + service_charge) as revenue, count(*)::int as orders
               from orders where status = 'completed' and ${IST("completed_at")}::date = ${TODAY} group by 1 order by 1`,
          )
        : null,
      q<{ name: string; qty: number; revenue: number }>(
        `select i.name, sum(i.qty)::int as qty, sum(i.line_total) as revenue from order_items i join orders o on o.id = i.order_id
          where o.status not in ('cancelled','rejected') and ${IST("o.created_at")}::date = ${TODAY}
          group by i.name order by qty desc limit 5`,
      ),
      money
        ? q<{ method: string; amount: number }>(
            `select method, sum(case when kind = 'refund' then -amount else amount end) as amount from payments
              where ${IST("created_at")}::date = ${TODAY} group by method order by 2 desc`,
          )
        : null,
      stock
        ? q<{ id: string; name: string; stock_qty: number; min_qty: number; display_unit: string }>(
            `select id, name, stock_qty, min_qty, display_unit from inventory_items
              where is_active and min_qty > 0 and stock_qty <= min_qty order by (stock_qty / nullif(min_qty, 0)) nulls first limit 6`,
          )
        : null,
      q<{ new_today: number; birthdays_today: number; returning_today: number }>(
        `select (select count(*)::int from customers where ${IST("created_at")}::date = ${TODAY}) as new_today,
                (select count(*)::int from customers where is_active and dob is not null and to_char(dob, 'MM-DD') = to_char(${IST("now()")}, 'MM-DD')) as birthdays_today,
                (select count(distinct customer_id)::int from orders where customer_id is not null and ${IST("created_at")}::date = ${TODAY}) as returning_today`,
      ),
      money ? q<{ due: number }>("select coalesce(sum(total - amount_paid), 0) as due from purchases where status = 'received'") : null,
    ]);

    const byStatus = Object.fromEntries(live.rows.map((r) => [r.status, r.n]));
    const unpaidServed = await q<{ n: number; due: number }>("select count(*)::int as n, coalesce(sum(total - amount_paid),0) as due from orders where status in ('served','ready') and payment_status <> 'paid'");

    let today = null;
    if (sales) {
      const [t, y] = sales.rows;
      today = {
        orders: t?.orders ?? 0,
        revenue: Number(t?.revenue ?? 0),
        gross: Number(t?.gross ?? 0),
        avg: t?.orders ? Number(t.revenue) / t.orders : null,
        yesterday_same_time: Number(y?.same_time ?? 0),
        yesterday_same_time_orders: y?.same_time_orders ?? 0,
        yesterday_total: Number(y?.revenue ?? 0),
      };
    }

    return {
      at: new Date().toISOString(),
      live: {
        new: byStatus.new ?? 0,
        in_kitchen: (byStatus.accepted ?? 0) + (byStatus.preparing ?? 0),
        ready: byStatus.ready ?? 0,
        served: byStatus.served ?? 0,
        late: live.rows.reduce((s, r) => s + r.late, 0),
        awaiting_payment: unpaidServed.rows[0].n,
        awaiting_payment_amount: Number(unpaidServed.rows[0].due),
      },
      tables: tables.rows[0],
      today,
      hourly: hourly?.rows.map((h) => ({ ...h, revenue: Number(h.revenue) })) ?? null,
      payments: methods?.rows.map((m) => ({ ...m, amount: Number(m.amount) })) ?? null,
      top_items: top.rows.map((t) => ({ ...t, revenue: Number(t.revenue) })),
      low_stock: lowStock?.rows ?? null,
      customers: customers.rows[0],
      supplier_due: supplierDue ? Number(supplierDue.rows[0].due) : null,
      recent: recent.rows,
    };
  },
  { permission: "dashboard.view" },
);
