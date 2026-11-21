import { z } from "zod";
import { api, body, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { cancelPurchase } from "@/server/inventory";
import { audit } from "@/server/audit";

const Schema = z.object({ reason: z.string().trim().min(3, "Say why").max(200) });

/** Reverses a purchase entered by mistake: stock and average cost are unwound. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { reason } = await body(ctx.req, Schema);
    await tx(async (t) => {
      const { rows } = await t.query<{ number: number; status: string }>("select number, status from purchases where id = $1 for update", [id]);
      if (!rows[0]) throw notFound("Purchase");
      if (rows[0].status === "cancelled") throw conflict("This purchase is already cancelled.");
      await cancelPurchase(t, id, ctx.user!.id);
      await t.query("update purchases set status = 'cancelled', notes = trim(notes || E'\\nCancelled: ' || $2) where id = $1", [id, reason]);
      await audit(t, ctx, "cancel", "purchase", id, `Cancelled purchase #${rows[0].number}`, { reason });
    });
    return { ok: true };
  },
  { permission: "purchases.manage" },
);
