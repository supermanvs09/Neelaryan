import { z } from "zod";
import { api, body, conflict } from "@/server/http";
import { tx } from "@/server/db";
import { recordPayment, transition, type OrderStatus } from "@/server/orders";
import { audit } from "@/server/audit";
import { round2 } from "@/lib/pricing";

const Schema = z.object({
  method: z.enum(["cash", "upi", "card", "other"]),
  reference: z.string().trim().max(60).default(""),
});

/**
 * Settles a table's bill in one step: records the payment for every open order's
 * balance and completes the orders that have been served — releasing the table.
 */
export const POST = api(
  async (ctx) => {
    const tableId = z.string().uuid().parse(ctx.params.id);
    const { method, reference } = await body(ctx.req, Schema);
    const result = await tx(async (t) => {
      const { rows } = await t.query<{ id: string; number: number; status: OrderStatus; total: number; amount_paid: number }>(
        "select id, number, status, total, amount_paid from orders where table_id = $1 and status in ('new','accepted','preparing','ready','served') order by created_at for update",
        [tableId],
      );
      if (!rows.length) throw conflict("This table has no open orders.");
      let paid = 0;
      let completed = 0;
      for (const o of rows) {
        const due = round2(Number(o.total) - Number(o.amount_paid));
        if (due > 0) {
          await recordPayment(t, o.id, { method, amount: due, reference }, ctx.user!.id);
          paid += due;
        }
        if (o.status === "served") {
          await transition(t, o.id, "completed", { userId: ctx.user!.id, permissions: ["orders.manage"] });
          completed++;
        }
      }
      const { rows: tb } = await t.query<{ label: string }>("select label from dining_tables where id = $1", [tableId]);
      await audit(t, ctx, "settle", "table", tableId, `Settled table ${tb[0]?.label}: ₹${round2(paid)} ${method.toUpperCase()}, ${completed} order(s) completed`);
      const stillOpen = rows.length - completed;
      return { paid: round2(paid), completed, still_open: stillOpen };
    });
    return result;
  },
  { permission: "billing.manage" },
);
