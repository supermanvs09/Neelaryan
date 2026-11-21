import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api, body, bad, searchParams } from "@/server/http";
import { q, tx } from "@/server/db";
import { createOrder } from "@/server/orders";
import { audit } from "@/server/audit";

const ListQuery = z.object({
  view: z.enum(["active", "history"]).default("active"),
  type: z.enum(["dine_in", "takeaway"]).optional(),
  status: z.string().max(20).optional(),
  payment: z.enum(["unpaid", "partial", "paid", "refunded"]).optional(),
  table: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/**
 * Orders list. "active" = everything still open plus today's finished orders
 * (the live board); "history" = filtered search across dates.
 */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, ListQuery);
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (f.view === "active") {
      where.push(`(o.status in ('new','accepted','preparing','ready','served') or (o.created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)`);
    } else {
      if (f.from) where.push(`(o.created_at at time zone 'Asia/Kolkata')::date >= ${p(f.from)}`);
      if (f.to) where.push(`(o.created_at at time zone 'Asia/Kolkata')::date <= ${p(f.to)}`);
    }
    if (f.type) where.push(`o.type = ${p(f.type)}`);
    if (f.status) where.push(`o.status = ${p(f.status)}`);
    if (f.payment) where.push(`o.payment_status = ${p(f.payment)}`);
    if (f.table) where.push(`o.table_id = ${p(f.table)}`);
    if (f.q) {
      const s = f.q.replace(/^#/, "");
      where.push(`(o.number::text = ${p(s)} or o.customer_name ilike ${p(`%${s}%`)} or o.customer_phone like ${p(`%${s}%`)})`);
    }
    const { rows } = await q(
      `select o.id, o.number, o.type, o.channel, o.price_tier, o.status, o.payment_status, o.total, o.amount_paid, o.discount,
              o.customer_name, o.customer_phone, o.notes, o.created_at, o.accepted_at, o.ready_at, o.updated_at,
              t.label as table_label, o.table_id, o.customer_id,
              coalesce((select json_agg(json_build_object('name', i.name, 'variant', i.variant_name, 'qty', i.qty, 'modifiers', i.modifiers, 'notes', i.notes) order by i.id)
                          from order_items i where i.order_id = o.id), '[]') as items
         from orders o left join dining_tables t on t.id = o.table_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by o.created_at desc limit ${p(f.limit)}`,
      params,
    );
    return { orders: rows, at: new Date().toISOString() };
  },
  { permission: ["orders.view"] },
);

const PosLine = z.object({
  item_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  modifier_ids: z.array(z.string().uuid()).max(40).default([]),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(140).optional(),
});

const PosSchema = z.object({
  idempotency_key: z.string().uuid().default(() => randomUUID()),
  type: z.enum(["dine_in", "takeaway"]),
  table_id: z.string().uuid().nullable().optional(),
  tier: z.enum(["retail", "wholesale"]).default("retail"),
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().trim().max(40).default(""),
  customer_phone: z
    .string()
    .trim()
    .regex(/^([6-9]\d{9})?$/, "Enter a valid 10-digit mobile number")
    .default(""),
  notes: z.string().trim().max(200).default(""),
  lines: z.array(PosLine).max(40).default([]),
  products: z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(999) })).max(40).default([]),
  reward_code: z.string().trim().max(20).nullable().optional(),
  discount: z.number().min(0).max(100000).default(0),
});

/** Counter / POS order. Confirmed by staff immediately (stock is deducted now). */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, PosSchema);
    if (input.type === "dine_in" && !input.table_id) throw bad("Choose the table for a dine-in order.", { table_id: "Choose a table" });
    if (input.discount > 0 && !ctx.user!.permissions.includes("billing.refund") && !ctx.user!.permissions.includes("finance.view")) {
      throw bad("Only managers can give a manual discount.");
    }
    const order = await tx(async (t) => {
      if (input.table_id) {
        const tb = await t.query("select 1 from dining_tables where id = $1 and is_active", [input.table_id]);
        if (!tb.rows.length) throw bad("That table isn't available.");
      }
      // A registered member giving their number at the counter earns points on this order.
      let customerId = input.customer_id ?? null;
      if (!customerId && input.customer_phone) {
        const c = await t.query<{ id: string }>("select id from customers where phone = $1 and is_active limit 1", [input.customer_phone]);
        customerId = c.rows[0]?.id ?? null;
      }
      const o = await createOrder(t, {
        lines: input.lines,
        products: input.products,
        tier: input.tier,
        customerId,
        rewardCode: input.reward_code || null,
        manualDiscount: input.discount,
        type: input.type,
        channel: "pos",
        tableId: input.type === "dine_in" ? input.table_id ?? null : null,
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        notes: input.notes,
        idempotencyKey: input.idempotency_key,
        accessHash: null,
        createdBy: ctx.user!.id,
        autoAccept: true,
      });
      if (!o.replayed) {
        await audit(t, ctx, "create", "order", o.id, `Created ${input.tier === "wholesale" ? "wholesale " : ""}order #${o.number} at the counter (₹${o.total})`, {
          discount: input.discount || undefined,
        });
      }
      return o;
    });
    return { id: order.id, number: order.number, total: order.total };
  },
  { permission: "orders.create" },
);
