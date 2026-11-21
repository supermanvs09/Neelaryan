import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { recordPayment } from "@/server/orders";
import { audit } from "@/server/audit";

const PaymentSchema = z.object({
  method: z.enum(["cash", "upi", "card", "other"]),
  amount: z.number().positive().max(1_000_000),
  reference: z.string().trim().max(60).default(""),
});

export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const p = await body(ctx.req, PaymentSchema);
    const r = await tx(async (t) => {
      const res = await recordPayment(t, id, p, ctx.user!.id);
      const { rows } = await t.query<{ number: number }>("select number from orders where id = $1", [id]);
      await audit(t, ctx, "payment", "order", id, `Recorded ₹${p.amount} ${p.method.toUpperCase()} for order #${rows[0].number}`, { reference: p.reference || undefined });
      return res;
    });
    return { ok: true, payment_status: r.status };
  },
  { permission: "billing.manage" },
);
