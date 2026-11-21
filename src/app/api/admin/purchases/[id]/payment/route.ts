import { z } from "zod";
import { api, body, bad, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { round2 } from "@/lib/pricing";

const Schema = z.object({ amount: z.number().positive("Enter an amount").max(10_000_000) });

/** Records a payment to the supplier against an unpaid / part-paid purchase. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { amount } = await body(ctx.req, Schema);
    return tx(async (t) => {
      const { rows } = await t.query<{ number: number; status: string; total: number; amount_paid: number }>("select number, status, total, amount_paid from purchases where id = $1 for update", [id]);
      const p = rows[0];
      if (!p) throw notFound("Purchase");
      if (p.status === "cancelled") throw conflict("This purchase was cancelled.");
      const due = round2(p.total - p.amount_paid);
      if (amount > due + 0.001) throw bad(`Only ₹${due} is due on this purchase.`, { amount: "More than what's due" });
      const paid = round2(p.amount_paid + amount);
      const status = paid >= p.total - 0.001 ? "paid" : "partial";
      await t.query("update purchases set amount_paid = $2, payment_status = $3 where id = $1", [id, paid, status]);
      await audit(t, ctx, "payment", "purchase", id, `Paid ₹${amount} to supplier for purchase #${p.number}`, { amount });
      return { amount_paid: paid, payment_status: status };
    });
  },
  { permission: "purchases.manage" },
);
