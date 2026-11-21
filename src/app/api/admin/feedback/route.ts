import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { q } from "@/server/db";

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

/** Guest ratings: average, spread, and each comment with its order. */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const range = "(f.created_at at time zone 'Asia/Kolkata')::date between $1 and $2";
    const [summary, list] = await Promise.all([
      q<{ rating: number; n: number }>(`select f.rating, count(*)::int as n from order_feedback f where ${range} group by f.rating`, [f.from, f.to]),
      q(
        `select f.order_id, f.rating, f.comment, f.created_at, o.number, o.type, o.customer_name, t.label as table_label,
                (select string_agg(i.qty || ' × ' || i.name, ', ' order by i.id) from order_items i where i.order_id = o.id) as items
           from order_feedback f join orders o on o.id = f.order_id left join dining_tables t on t.id = o.table_id
          where ${range} ${f.rating ? "and f.rating = $3" : ""} order by f.created_at desc limit 300`,
        f.rating ? [f.from, f.to, f.rating] : [f.from, f.to],
      ),
    ]);
    const spread = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: summary.rows.find((x) => x.rating === r)?.n ?? 0 }));
    const total = spread.reduce((s, x) => s + x.count, 0);
    const average = total ? spread.reduce((s, x) => s + x.rating * x.count, 0) / total : null;
    return { total, average, spread, feedback: list.rows };
  },
  { permission: ["customers.view", "reports.view"] },
);
