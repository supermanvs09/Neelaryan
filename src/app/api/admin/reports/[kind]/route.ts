import { z } from "zod";
import { api, csv, notFound, requirePermission, searchParams } from "@/server/http";
import { q } from "@/server/db";
import { listInventory } from "@/server/inventory-admin";
import { formatQty } from "@/lib/units";
import { round2 } from "@/lib/pricing";

const Range = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(["json", "csv"]).default("json"),
  type: z.enum(["dine_in", "takeaway"]).optional().or(z.literal("").transform(() => undefined)),
  status: z.string().max(20).optional(),
});

const IST = (col: string) => `(${col} at time zone 'Asia/Kolkata')::date`;
const when = (v: string) => new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
const KINDS = ["orders", "items", "hours", "tax", "payments", "inventory"] as const;

/**
 * Reports. Sales figures count completed orders (by completion date) unless stated.
 * Every report is available as JSON (screens) and CSV (spreadsheets / accountant).
 */
export const GET = api(
  async (ctx) => {
    const kind = ctx.params.kind as (typeof KINDS)[number];
    if (!KINDS.includes(kind)) throw notFound("Report");
    if (kind === "inventory") requirePermission(ctx, "inventory.view");
    else if (kind === "orders") requirePermission(ctx, ["orders.view", "reports.view"]);
    else requirePermission(ctx, "reports.view");
    const isCsv = ctx.req.nextUrl.searchParams.get("format") === "csv";

    if (kind === "inventory") {
      const items = await listInventory();
      if (isCsv) {
        const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        return csv(`stock-valuation-${day}.csv`, [
          ["Item", "Category", "In stock", "Minimum", "Status", "Avg cost / base unit (₹)", "Value (₹)", "Next expiry", "Sellable", "Retail price", "Wholesale price"],
          ...items.map((i) => [i.name, i.category ?? "", formatQty(Number(i.stock_qty), i.display_unit), formatQty(Number(i.min_qty), i.display_unit), i.out ? "Out" : i.low ? "Low" : "OK", i.avg_cost ?? "", i.value ?? "", i.next_expiry ?? "", i.is_sellable ? "Yes" : "No", i.retail_price ?? "", i.wholesale_price ?? ""]),
        ]);
      }
      return { items };
    }

    const f = searchParams(ctx.req, Range);
    const args: unknown[] = [f.from, f.to];
    const name = (k: string) => `${k}-${f.from}-to-${f.to}.csv`;

    if (kind === "orders") {
      let where = `${IST("o.created_at")} between $1 and $2`;
      if (f.type) where += ` and o.type = $${args.push(f.type)}`;
      if (f.status) where += ` and o.status = $${args.push(f.status)}`;
      const { rows } = await q<{ number: number; created_at: string; completed_at: string | null; type: string; channel: string; price_tier: string; table_label: string | null; status: string; payment_status: string; customer_name: string; customer_phone: string; subtotal: number; discount: number; service_charge: number; tax: number; total: number; amount_paid: number; items: string }>(
        `select o.number, o.created_at, o.completed_at, o.type, o.channel, o.price_tier, t.label as table_label, o.status, o.payment_status, o.customer_name, o.customer_phone,
                o.subtotal, o.discount, o.service_charge, o.tax, o.total, o.amount_paid,
                (select string_agg(i.qty || ' × ' || i.name || case when i.variant_name <> '' then ' (' || i.variant_name || ')' else '' end, '; ' order by i.id) from order_items i where i.order_id = o.id) as items
           from orders o left join dining_tables t on t.id = o.table_id where ${where} order by o.created_at limit 20000`,
        args,
      );
      if (!isCsv) return { orders: rows };
      return csv(name("orders"), [
        ["Order", "Placed", "Completed", "Type", "Channel", "Tier", "Table", "Status", "Payment", "Customer", "Mobile", "Items", "Subtotal", "Discount", "Service charge", "GST", "Total", "Paid"],
        ...rows.map((r) => [r.number, when(r.created_at), r.completed_at ? when(r.completed_at) : "", r.type, r.channel, r.price_tier, r.table_label ?? "", r.status, r.payment_status, r.customer_name, r.customer_phone, r.items, r.subtotal, r.discount, r.service_charge, r.tax, r.total, r.amount_paid]),
      ]);
    }

    if (kind === "items") {
      const { rows } = await q<{ name: string; category: string | null; source: string; qty: number; revenue: number; cost: number | null; uncosted: number }>(
        `select i.name, coalesce(mc.name, ic.name) as category, case when i.inventory_item_id is not null then 'product' else 'menu' end as source,
                sum(i.qty)::int as qty, sum(i.line_total) as revenue, sum(i.qty * i.unit_cost) as cost, count(*) filter (where i.unit_cost is null)::int as uncosted
           from order_items i join orders o on o.id = i.order_id
           left join menu_items m on m.id = i.menu_item_id left join menu_categories mc on mc.id = m.category_id
           left join inventory_items inv on inv.id = i.inventory_item_id left join inventory_categories ic on ic.id = inv.category_id
          where o.status = 'completed' and ${IST("o.completed_at")} between $1 and $2
          group by 1, 2, 3 order by revenue desc`,
        args,
      );
      const out = rows.map((r) => {
        const cost = r.uncosted ? null : round2(Number(r.cost ?? 0));
        return { ...r, revenue: round2(Number(r.revenue)), cost, profit: cost === null ? null : round2(Number(r.revenue) - cost), margin: cost === null || !Number(r.revenue) ? null : (Number(r.revenue) - cost) / Number(r.revenue) };
      });
      if (!isCsv) return { items: out, note: "Revenue here is line value before order-level discounts and GST." };
      return csv(name("sales-by-item"), [
        ["Item", "Category", "Type", "Qty sold", "Sales (₹, before bill discount)", "Cost (₹)", "Profit (₹)", "Margin %"],
        ...out.map((r) => [r.name, r.category ?? "", r.source, r.qty, r.revenue, r.cost ?? "No cost set", r.profit ?? "", r.margin === null ? "" : (r.margin * 100).toFixed(1)]),
      ]);
    }

    if (kind === "hours") {
      const { rows } = await q<{ dow: number; hour: number; orders: number; revenue: number }>(
        `select extract(isodow from created_at at time zone 'Asia/Kolkata')::int as dow, extract(hour from created_at at time zone 'Asia/Kolkata')::int as hour,
                count(*)::int as orders, sum(subtotal - discount + service_charge) as revenue
           from orders where status = 'completed' and ${IST("completed_at")} between $1 and $2 group by 1, 2 order by 1, 2`,
        args,
      );
      if (!isCsv) return { cells: rows.map((r) => ({ ...r, revenue: round2(Number(r.revenue)) })) };
      const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return csv(name("sales-by-hour"), [["Day", "Hour", "Orders", "Revenue ex GST (₹)"], ...rows.map((r) => [DOW[r.dow], `${String(r.hour).padStart(2, "0")}:00`, r.orders, round2(Number(r.revenue))])]);
    }

    if (kind === "tax") {
      const { rows } = await q<{ d: string; orders: number; taxable: number; gst: number; total: number }>(
        `select ${IST("completed_at")}::text as d, count(*)::int as orders, sum(subtotal - discount + service_charge) as taxable, sum(tax) as gst, sum(total) as total
           from orders where status = 'completed' and ${IST("completed_at")} between $1 and $2 group by 1 order by 1`,
        args,
      );
      const out = rows.map((r) => ({ ...r, taxable: round2(Number(r.taxable)), gst: round2(Number(r.gst)), cgst: round2(Number(r.gst) / 2), sgst: round2(Number(r.gst) / 2), total: round2(Number(r.total)) }));
      if (!isCsv) return { days: out };
      return csv(name("gst-summary"), [["Date", "Bills", "Taxable value (₹)", "CGST (₹)", "SGST (₹)", "Total GST (₹)", "Invoice value (₹)"], ...out.map((r) => [r.d, r.orders, r.taxable, r.cgst, r.sgst, r.gst, r.total])]);
    }

    // payments
    const { rows } = await q<{ created_at: string; kind: string; method: string; amount: number; reference: string; number: number; by: string | null }>(
      `select p.created_at, p.kind, p.method, p.amount, p.reference, o.number, u.name as by
         from payments p join orders o on o.id = p.order_id left join users u on u.id = p.created_by
        where ${IST("p.created_at")} between $1 and $2 order by p.created_at limit 20000`,
      args,
    );
    if (!isCsv) return { payments: rows };
    return csv(name("payments"), [["Date", "Type", "Method", "Amount (₹)", "Order", "Reference", "Taken by"], ...rows.map((r) => [when(r.created_at), r.kind, r.method, r.kind === "refund" ? -r.amount : r.amount, r.number, r.reference, r.by ?? ""])]);
  },
  { permission: ["reports.view", "orders.view", "inventory.view"] },
);
