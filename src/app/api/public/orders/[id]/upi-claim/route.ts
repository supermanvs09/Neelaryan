import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { canAccessOrder } from "@/server/order-access";
import { claimUpi } from "@/server/service";
import { notifyLater, pushStaff } from "@/server/push";
import { rateLimit } from "@/server/ratelimit";

const Schema = z.object({ reference: z.string().trim().max(40).regex(/^[A-Za-z0-9 -]*$/, "Use letters and numbers only").optional() });

/** The guest says "I've paid by UPI". Staff check their UPI app and confirm the payment. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    if (!(await canAccessOrder(id, ctx.req.headers.get("x-order-token"), ctx.customer?.id ?? null))) throw notFound("Order");
    await rateLimit(`upi-claim:${id}`, 5, 600);
    const { reference } = await body(ctx.req, Schema);
    const r = await tx((t) => claimUpi(t, id, reference ?? null));
    if (!r.already) {
      const { rows } = await q<{ number: number; total: number }>("select number, total from orders where id = $1", [id]);
      notifyLater(() => pushStaff({ title: `UPI paid? Order #${rows[0].number}`, body: `Check ₹${Number(rows[0].total)} in your UPI app${reference ? ` · ref ${reference}` : ""}`, url: "/admin/orders", tag: `upi-${id}` }));
    }
    return { ok: true };
  },
  { auth: "public" },
);
