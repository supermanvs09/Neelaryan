import "server-only";
import { z } from "zod";
import { q } from "./db";
import { round2 } from "@/lib/pricing";

/**
 * Profit & loss — every figure comes from recorded transactions.
 *
 *  Revenue   = completed orders, excluding GST (subtotal − discount + service charge),
 *              booked on the day the order was completed; split retail / wholesale by price tier.
 *  Refunds   = refunds on completed orders, ex-GST share, booked on the refund day.
 *  COGS      = Σ qty × unit cost snapshotted when stock was deducted (recipe / product average cost,
 *              or the manual cost price on dishes without a recipe).
 *  Wastage   = stock written off, at average cost.
 *  Stock adj = losses (or gains) found in stock counts and corrections.
 *  Expenses  = recorded operating expenses (voided ones excluded).
 *  Net profit = Revenue − Refunds − COGS − Wastage − Stock adj − Expenses.
 * Purchases are not expensed directly: they become stock and reach the P&L through COGS / wastage.
 */

export const PeriodQuery = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    group: z.enum(["day", "week", "month"]).default("day"),
  })
  .refine((v) => v.from <= v.to, { message: "The start date must be before the end date.", path: ["from"] })
  .refine((v) => (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 731, { message: "Choose a period of up to two years.", path: ["to"] });
export type Period = z.infer<typeof PeriodQuery>;

const IST = (col: string) => `(${col} at time zone 'Asia/Kolkata')::date`;

interface Bucket {
  key: string;
  orders: number;
  orders_retail: number;
  orders_wholesale: number;
  revenue_retail: number;
  revenue_wholesale: number;
  revenue: number;
  discounts: number;
  gst: number;
  refunds: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  wastage: number;
  stock_adjustments: number;
  expenses: number;
  net_profit: number;
}

function bucketKey(day: string, group: Period["group"]) {
  if (group === "day") return day;
  if (group === "month") return day.slice(0, 7);
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function* days(from: string, to: string) {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

export async function profitAndLoss(p: Period) {
  const args = [p.from, p.to];
  const [sales, cogs, refunds, stock, expenses, expenseCats, collections, purchases] = await Promise.all([
    q<{ d: string; tier: string; orders: number; net: number; gst: number; discount: number }>(
      `select ${IST("completed_at")}::text as d, price_tier as tier, count(*)::int as orders,
              sum(subtotal - discount + service_charge) as net, sum(tax) as gst, sum(discount) as discount
         from orders where status = 'completed' and ${IST("completed_at")} between $1 and $2 group by 1, 2`,
      args,
    ),
    q<{ d: string; cogs: number; uncosted: number }>(
      `select ${IST("o.completed_at")}::text as d, coalesce(sum(i.qty * i.unit_cost), 0) as cogs, count(*) filter (where i.unit_cost is null)::int as uncosted
         from order_items i join orders o on o.id = i.order_id
        where o.status = 'completed' and ${IST("o.completed_at")} between $1 and $2 group by 1`,
      args,
    ),
    q<{ d: string; net: number }>(
      `select ${IST("p.created_at")}::text as d, sum(p.amount * (o.total - o.tax) / nullif(o.total, 0)) as net
         from payments p join orders o on o.id = p.order_id
        where p.kind = 'refund' and o.status = 'completed' and ${IST("p.created_at")} between $1 and $2 group by 1`,
      args,
    ),
    q<{ d: string; kind: string; loss: number; unvalued: number }>(
      `select ${IST("created_at")}::text as d, kind, coalesce(sum(-value), 0) as loss, count(*) filter (where value is null)::int as unvalued
         from stock_movements where kind in ('wastage','adjustment','count') and ${IST("created_at")} between $1 and $2 group by 1, 2`,
      args,
    ),
    q<{ d: string; amount: number }>(`select spent_on::text as d, sum(amount) as amount from expenses where not is_void and spent_on between $1 and $2 group by 1`, args),
    q<{ name: string; amount: number }>(
      `select c.name, sum(e.amount) as amount from expenses e join expense_categories c on c.id = e.category_id
        where not e.is_void and e.spent_on between $1 and $2 group by c.name order by 2 desc`,
      args,
    ),
    q<{ method: string; received: number; refunded: number }>(
      `select method, coalesce(sum(amount) filter (where kind = 'payment'), 0) as received, coalesce(sum(amount) filter (where kind = 'refund'), 0) as refunded
         from payments where ${IST("created_at")} between $1 and $2 group by method order by 2 desc`,
      args,
    ),
    q<{ total: number; paid: number; count: number }>(
      `select coalesce(sum(total), 0) as total, coalesce(sum(amount_paid), 0) as paid, count(*)::int as count
         from purchases where status = 'received' and purchased_on between $1 and $2`,
      args,
    ),
  ]);

  const map = new Map<string, Bucket>();
  const get = (day: string) => {
    const k = bucketKey(day, p.group);
    let b = map.get(k);
    if (!b) {
      b = { key: k, orders: 0, orders_retail: 0, orders_wholesale: 0, revenue_retail: 0, revenue_wholesale: 0, revenue: 0, discounts: 0, gst: 0, refunds: 0, net_revenue: 0, cogs: 0, gross_profit: 0, wastage: 0, stock_adjustments: 0, expenses: 0, net_profit: 0 };
      map.set(k, b);
    }
    return b;
  };
  for (const d of days(p.from, p.to)) get(d); // every period shows, even with no activity

  for (const r of sales.rows) {
    const b = get(r.d);
    b.orders += r.orders;
    b.revenue += Number(r.net);
    b.gst += Number(r.gst);
    b.discounts += Number(r.discount);
    if (r.tier === "wholesale") {
      b.orders_wholesale += r.orders;
      b.revenue_wholesale += Number(r.net);
    } else {
      b.orders_retail += r.orders;
      b.revenue_retail += Number(r.net);
    }
  }
  let uncosted = 0;
  for (const r of cogs.rows) {
    get(r.d).cogs += Number(r.cogs);
    uncosted += r.uncosted;
  }
  for (const r of refunds.rows) get(r.d).refunds += Number(r.net);
  let unvalued = 0;
  for (const r of stock.rows) {
    if (r.kind === "wastage") get(r.d).wastage += Number(r.loss);
    else get(r.d).stock_adjustments += Number(r.loss);
    unvalued += r.unvalued;
  }
  for (const r of expenses.rows) get(r.d).expenses += Number(r.amount);

  const buckets = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const b of buckets) {
    b.net_revenue = b.revenue - b.refunds;
    b.gross_profit = b.net_revenue - b.cogs;
    b.net_profit = b.gross_profit - b.wastage - b.stock_adjustments - b.expenses;
    for (const k of Object.keys(b) as (keyof Bucket)[]) if (k !== "key" && typeof b[k] === "number") (b[k] as number) = round2(b[k] as number);
  }

  const sum = (k: keyof Omit<Bucket, "key">) => round2(buckets.reduce((s, b) => s + (b[k] as number), 0));
  const totals = {
    orders: sum("orders"),
    orders_retail: sum("orders_retail"),
    orders_wholesale: sum("orders_wholesale"),
    revenue_retail: sum("revenue_retail"),
    revenue_wholesale: sum("revenue_wholesale"),
    revenue: sum("revenue"),
    discounts: sum("discounts"),
    gst: sum("gst"),
    refunds: sum("refunds"),
    net_revenue: sum("net_revenue"),
    cogs: sum("cogs"),
    gross_profit: sum("gross_profit"),
    wastage: sum("wastage"),
    stock_adjustments: sum("stock_adjustments"),
    expenses: sum("expenses"),
    net_profit: sum("net_profit"),
  };
  const ratio = (n: number) => (totals.net_revenue > 0 ? n / totals.net_revenue : null);

  return {
    period: p,
    buckets,
    totals: {
      ...totals,
      gross_margin: ratio(totals.gross_profit),
      net_margin: ratio(totals.net_profit),
      food_cost_pct: ratio(totals.cogs),
      avg_order: totals.orders ? round2(totals.revenue / totals.orders) : null,
    },
    expenses_by_category: expenseCats.rows.map((r) => ({ name: r.name, amount: round2(Number(r.amount)) })),
    collections: collections.rows.map((r) => ({ method: r.method, received: round2(Number(r.received)), refunded: round2(Number(r.refunded)), net: round2(Number(r.received) - Number(r.refunded)) })),
    purchases: { count: purchases.rows[0].count, total: round2(Number(purchases.rows[0].total)), paid: round2(Number(purchases.rows[0].paid)) },
    warnings: {
      /** sold lines with no cost (no recipe and no cost price) — COGS is understated */
      uncosted_lines: uncosted,
      /** wastage / adjustments on items with no cost yet — loss is understated */
      unvalued_stock_movements: unvalued,
    },
  };
}
