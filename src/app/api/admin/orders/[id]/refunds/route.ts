import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { recordRefund } from "@/server/orders";
import { audit } from "@/server/audit";

const Schema = z.object({
  method: z.enum(["cash", "upi", "card", "other"]),
  amount: z.number().positive().max(1_000_000),
  reference: z.string().trim().max(60).default(""),
  reason: z.string().trim().min(3, "Give a reason for the refund").max(200),
});

/** Full or partial refund (manager permission). A full refund of a completed order reverses its points. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const p = await body(ctx.req, Schema);
    const r = await tx(async (t) => {
      const res = await recordRefund(t, id, p, ctx.user!.id);
      const { rows } = await t.query<{ number: number }>("select number from orders where id = $1", [id]);
      await audit(t, ctx, "refund", "order", id, `Refunded ₹${p.amount} (${p.method.toUpperCase()}) on order #${rows[0].number}: ${p.reason}`);
      return res;
    });
    return { ok: true, payment_status: r.status };
  },
  { permission: "billing.refund" },
);
