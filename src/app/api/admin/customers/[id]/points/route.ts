import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { grantPoints, spendPoints } from "@/server/loyalty";

const Schema = z.object({
  points: z.number().int().min(-100000).max(100000).refine((n) => n !== 0, "Enter points to add or remove"),
  kind: z.enum(["adjust", "promo"]).default("adjust"),
  note: z.string().trim().min(3, "Say why").max(200),
});

/** Manual points: goodwill / promo grants, or corrections. Always with a reason, always audited. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, Schema);
    return tx(async (t) => {
      const { rows } = await t.query<{ name: string }>("select name from customers where id = $1", [id]);
      if (!rows[0]) throw notFound("Customer");
      if (input.points > 0) await grantPoints(t, id, input.points, { kind: input.kind, note: input.note, created_by: ctx.user!.id });
      else await spendPoints(t, id, -input.points, { kind: "adjust", note: input.note, created_by: ctx.user!.id });
      await audit(t, ctx, "points", "customer", id, `${input.points > 0 ? "Added" : "Removed"} ${Math.abs(input.points)} points ${input.points > 0 ? "to" : "from"} ${rows[0].name}`, input);
      const b = await t.query<{ points_balance: number }>("select points_balance from customers where id = $1", [id]);
      return { balance: b.rows[0].points_balance };
    });
  },
  { permission: "loyalty.manage" },
);
