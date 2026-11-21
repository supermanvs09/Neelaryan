import { z } from "zod";
import { api, body, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";

const Schema = z.object({ reason: z.string().trim().min(3, "Say why").max(200) });

/** Expenses are never deleted — a mistake is voided with a reason and stays on record. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { reason } = await body(ctx.req, Schema);
    await tx(async (t) => {
      const { rows } = await t.query<{ amount: number; is_void: boolean }>("select amount, is_void from expenses where id = $1 for update", [id]);
      if (!rows[0]) throw notFound("Expense");
      if (rows[0].is_void) throw conflict("This expense is already voided.");
      await t.query("update expenses set is_void = true, void_reason = $2 where id = $1", [id, reason]);
      await audit(t, ctx, "void", "expense", id, `Voided expense ₹${rows[0].amount}`, { reason });
    });
    return { ok: true };
  },
  { permission: "expenses.manage" },
);
