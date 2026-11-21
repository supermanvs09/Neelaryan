import { z } from "zod";
import { api, body, bad, conflict, ApiError } from "@/server/http";
import { q, tx } from "@/server/db";
import { getSetting } from "@/server/settings";
import { createOrder } from "@/server/orders";
import { sha256 } from "@/server/auth/session";
import { rateLimit } from "@/server/ratelimit";
import { validatePickup } from "@/server/service";
import { notifyLater, pushStaff } from "@/server/push";

const Line = z.object({
  item_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  modifier_ids: z.array(z.string().uuid()).max(40).default([]),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(140).optional(),
});

const Schema = z.object({
  idempotency_key: z.string().uuid(),
  access_token: z.string().min(32).max(100),
  table_token: z.string().max(60).nullable().optional(),
  type: z.enum(["dine_in", "takeaway"]),
  customer_name: z.string().trim().min(1, "Enter your name").max(40),
  customer_phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  notes: z.string().trim().max(200).default(""),
  lines: z.array(Line).min(1, "Your cart is empty").max(40),
  expected_total: z.number().min(0),
  use_points: z.number().int().min(0).max(1_000_000).default(0),
  reward_code: z.string().trim().max(20).nullable().optional(),
  payment_method: z.enum(["cash", "upi"]).default("cash"),
  /** pre-order pickup time (takeaway only), ISO */
  scheduled_for: z.string().max(40).nullable().optional(),
});

/**
 * Places a customer order (QR dine-in or takeaway). Prices come only from the
 * database; if the total differs from what the guest saw, the order is refused
 * with the new total so nobody pays a surprise amount.
 */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    await rateLimit(`order:ip:${ctx.ip ?? "?"}`, 12, 600, "You've placed several orders just now. Please wait a few minutes or ask our team.");
    const ordering = await getSetting("ordering");
    if (!ordering.accepting_orders) throw new ApiError(503, ordering.closed_message, "CLOSED");

    let tableId: string | null = null;
    if (input.type === "dine_in") {
      if (!input.table_token) throw bad("Scan the QR code on your table to order for dine-in.");
      const t = await q<{ id: string }>("select id from dining_tables where qr_token = $1 and is_active", [input.table_token]);
      if (!t.rows[0]) throw bad("This table's QR code is no longer valid. Please ask our team for help.", { table_token: "invalid" });
      tableId = t.rows[0].id;
    } else if (!ordering.takeaway_enabled) {
      throw new ApiError(503, "Takeaway orders are paused right now.", "TAKEAWAY_OFF");
    }

    const payments = await getSetting("payments");
    if (input.payment_method === "upi" && !(payments.upi_enabled && payments.upi_id)) throw bad("UPI isn't available right now. Please choose cash.", { payment_method: "Unavailable" });
    if (input.payment_method === "cash" && !payments.cash_enabled) throw bad("Please pay by UPI.", { payment_method: "Unavailable" });
    let scheduledFor: string | null = null;
    if (input.scheduled_for) {
      if (input.type !== "takeaway") throw bad("Pre-orders are for takeaway pickup.");
      if (!ordering.preorders_enabled) throw bad("Pre-orders are paused right now.");
      scheduledFor = validatePickup(input.scheduled_for);
    }

    const open = await q<{ n: number }>("select count(*)::int as n from orders where customer_phone = $1 and status in ('new','accepted','preparing','ready') and created_at > now() - interval '6 hours'", [input.customer_phone]);
    if (open.rows[0].n >= 5) throw conflict("You already have several orders in progress. Please wait for them or ask our team.");

    const order = await tx(async (t) => {
      const o = await createOrder(t, {
        lines: input.lines,
        tier: "retail",
        customerId: ctx.customer?.id ?? null,
        usePoints: input.use_points,
        rewardCode: input.reward_code || null,
        type: input.type,
        channel: tableId ? "qr" : "web",
        tableId,
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        notes: input.notes,
        idempotencyKey: input.idempotency_key,
        accessHash: sha256(input.access_token),
        createdBy: null,
        autoAccept: false,
        paymentMethod: input.payment_method,
        scheduledFor,
      });
      if (!o.replayed && Math.abs(Number(o.total) - input.expected_total) > 0.009) {
        throw new ApiError(409, `Prices changed while you were ordering — the new total is ₹${Number(o.total)}. Please review your cart.`, "TOTAL_CHANGED", { expected_total: String(o.total) });
      }
      return o;
    });
    if (!order.replayed) {
      const where = tableId ? `Table ${(await q<{ label: string }>("select label from dining_tables where id = $1", [tableId])).rows[0]?.label ?? ""}` : scheduledFor ? `Pre-order ${new Date(scheduledFor).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}` : "Takeaway";
      notifyLater(() => pushStaff({ title: `New order #${order.number}`, body: `${where} · ₹${Number(order.total)}`, url: "/admin/orders", tag: `new-${order.id}` }));
    }
    return { id: order.id, number: order.number, total: order.total };
  },
  { auth: "public" },
);
