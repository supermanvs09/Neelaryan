import { z } from "zod";
import { api, body, bad, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { RewardSchema } from "@/server/rewards";

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const v = await body(ctx.req, RewardSchema);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown> & { quantity_redeemed: number }>(
        "select name, description, points_cost, kind, menu_item_id, value, min_order, valid_from::text, valid_to::text, quantity_total, redemption_valid_days, is_active, quantity_redeemed from rewards where id = $1 for update",
        [id],
      )).rows[0];
      if (!before) throw notFound("Reward");
      if (v.quantity_total !== null && v.quantity_total < before.quantity_redeemed) throw bad(`${before.quantity_redeemed} have already been redeemed — the limit can't be lower.`, { quantity_total: "Lower than already redeemed" });
      await t.query(
        `update rewards set name=$2, description=$3, points_cost=$4, kind=$5, menu_item_id=$6, value=$7, min_order=$8, valid_from=$9, valid_to=$10,
                quantity_total=$11, redemption_valid_days=$12, is_active=$13, updated_at=now() where id=$1`,
        [id, v.name, v.description, v.points_cost, v.kind, v.kind === "free_item" ? v.menu_item_id : null, v.kind.startsWith("discount") ? v.value : null, v.min_order, v.valid_from, v.valid_to, v.quantity_total, v.redemption_valid_days, v.is_active],
      );
      const { quantity_redeemed: _q, ...b } = before;
      void _q;
      await audit(t, ctx, "update", "reward", id, `Updated reward ${v.name}`, diff(b, v));
    });
    return { ok: true };
  },
  { permission: "loyalty.manage" },
);
