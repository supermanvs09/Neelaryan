import { z } from "zod";
import { api, body, csv, searchParams } from "@/server/http";
import { q, tx } from "@/server/db";
import { PurchaseSchema, createPurchase } from "@/server/inventory-admin";

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplier: z.string().uuid().optional(),
  payment: z.enum(["paid", "partial", "unpaid"]).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (f.from) where.push(`p.purchased_on >= $${params.push(f.from)}`);
    if (f.to) where.push(`p.purchased_on <= $${params.push(f.to)}`);
    if (f.supplier) where.push(`p.supplier_id = $${params.push(f.supplier)}`);
    if (f.payment) where.push(`p.payment_status = $${params.push(f.payment)}`);
    const { rows } = await q<{ id: string; number: number; purchased_on: string; supplier: string | null; invoice_no: string; status: string; subtotal: number; tax: number; total: number; amount_paid: number; payment_status: string; lines: number }>(
      `select p.id, p.number, p.purchased_on::text, s.name as supplier, p.invoice_no, p.status, p.subtotal, p.tax, p.total, p.amount_paid, p.payment_status,
              (select count(*)::int from purchase_lines l where l.purchase_id = p.id) as lines, p.created_at
         from purchases p left join suppliers s on s.id = p.supplier_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by p.purchased_on desc, p.number desc limit 1000`,
      params,
    );
    if (f.format === "csv") {
      return csv(`purchases${f.from ? `-${f.from}` : ""}${f.to ? `-to-${f.to}` : ""}.csv`, [
        ["Purchase", "Date", "Supplier", "Invoice", "Status", "Subtotal (₹)", "Tax (₹)", "Total (₹)", "Paid (₹)", "Payment"],
        ...rows.map((r) => [r.number, r.purchased_on, r.supplier ?? "", r.invoice_no, r.status, r.subtotal, r.tax, r.total, r.amount_paid, r.payment_status]),
      ]);
    }
    return { purchases: rows };
  },
  { permission: ["purchases.manage", "finance.view"] },
);

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, PurchaseSchema);
    const p = await tx((t) => createPurchase(t, ctx, input));
    return p;
  },
  { permission: "purchases.manage" },
);
