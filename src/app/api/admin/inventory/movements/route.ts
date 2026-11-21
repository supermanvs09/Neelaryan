import { z } from "zod";
import { api, csv, searchParams } from "@/server/http";
import { q } from "@/server/db";
import { formatQty } from "@/lib/units";

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["opening", "purchase", "sale", "sale_return", "wastage", "adjustment", "count", "purchase_cancel"]).optional(),
  item: z.string().uuid().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

/** Stock ledger across items. Every change to stock is one row here. */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [f.from, f.to];
    let where = `(m.created_at at time zone 'Asia/Kolkata')::date between $1 and $2`;
    if (f.kind) where += ` and m.kind = $${params.push(f.kind)}`;
    if (f.item) where += ` and m.item_id = $${params.push(f.item)}`;
    const { rows } = await q<{ id: number; created_at: string; item: string; display_unit: string; kind: string; qty: number; unit_cost: number | null; value: number | null; reason: string; note: string; order_number: number | null; purchase_number: number | null; user_name: string | null }>(
      `select m.id, m.created_at, i.name as item, i.display_unit, m.kind, m.qty, m.unit_cost, m.value, m.reason, m.note, o.number as order_number, p.number as purchase_number, u.name as user_name
         from stock_movements m join inventory_items i on i.id = m.item_id
         left join orders o on o.id = m.order_id left join purchases p on p.id = m.purchase_id left join users u on u.id = m.user_id
        where ${where} order by m.created_at desc, m.id desc limit 5000`,
      params,
    );
    if (f.format === "csv") {
      return csv(`stock-movements-${f.from}-to-${f.to}.csv`, [
        ["Date", "Item", "Type", "Quantity", "Value (₹)", "Reason", "Note", "Order", "Purchase", "By"],
        ...rows.map((r) => [new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), r.item, r.kind, formatQty(Number(r.qty), r.display_unit), r.value ?? "", r.reason, r.note, r.order_number ?? "", r.purchase_number ?? "", r.user_name ?? ""]),
      ]);
    }
    return { movements: rows };
  },
  { permission: "inventory.view" },
);
