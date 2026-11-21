import { api, csv, searchParams } from "@/server/http";
import { PeriodQuery, profitAndLoss } from "@/server/finance";

export const GET = api(
  async (ctx) => {
    const p = searchParams(ctx.req, PeriodQuery);
    const r = await profitAndLoss(p);
    if (ctx.req.nextUrl.searchParams.get("format") === "csv") {
      const t = r.totals;
      return csv(`profit-and-loss-${p.from}-to-${p.to}.csv`, [
        ["Period", "Orders", "Retail revenue", "Wholesale revenue", "Revenue (ex GST)", "Refunds", "Net revenue", "COGS", "Gross profit", "Wastage", "Stock adjustments", "Expenses", "Net profit", "GST collected", "Discounts"],
        ...r.buckets.map((b) => [b.key, b.orders, b.revenue_retail, b.revenue_wholesale, b.revenue, b.refunds, b.net_revenue, b.cogs, b.gross_profit, b.wastage, b.stock_adjustments, b.expenses, b.net_profit, b.gst, b.discounts]),
        ["Total", t.orders, t.revenue_retail, t.revenue_wholesale, t.revenue, t.refunds, t.net_revenue, t.cogs, t.gross_profit, t.wastage, t.stock_adjustments, t.expenses, t.net_profit, t.gst, t.discounts],
      ]);
    }
    return r;
  },
  { permission: "finance.view" },
);
