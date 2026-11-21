import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { buildOrder } from "@/server/orders";
import { getSetting } from "@/server/settings";
import { maxPointsDiscount } from "@/server/loyalty";
import { rateLimit } from "@/server/ratelimit";

const Schema = z.object({
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        variant_id: z.string().uuid().nullable().optional(),
        modifier_ids: z.array(z.string().uuid()).max(40).default([]),
        qty: z.number().int().min(1).max(50),
      }),
    )
    .min(1)
    .max(40),
  use_points: z.number().int().min(0).max(1_000_000).default(0),
  reward_code: z.string().trim().max(20).nullable().optional(),
});

/**
 * Prices a cart exactly as placing it would — same code path, nothing saved — so the
 * checkout shows the real total including points and reward discounts.
 */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    await rateLimit(`quote:${ctx.ip ?? "?"}`, 120, 600);
    const customerId = ctx.customer?.id ?? null;
    const r = await tx(async (t) => {
      const built = await buildOrder(t, { lines: input.lines, tier: "retail", customerId, usePoints: input.use_points, rewardCode: input.reward_code || null });
      let points = null;
      if (customerId) {
        const [s, c] = await Promise.all([getSetting("loyalty", t), t.query<{ points_balance: number }>("select points_balance from customers where id = $1", [customerId])]);
        const balance = c.rows[0]?.points_balance ?? 0;
        const rewardDiscount = built.redemption?.discount ?? 0;
        const cap = maxPointsDiscount(built.totals.subtotal - rewardDiscount, balance, s);
        points = { balance, max: cap.points, max_value: cap.value, min: s.min_redeem_points, point_value: s.point_value, enabled: s.enabled };
      }
      return { totals: built.totals, points_used: built.pointsUsed, reward: built.redemption ? { code: built.redemption.code, label: built.redemption.label, discount: built.redemption.discount } : null, points };
    });
    return r;
  },
  { auth: "public" },
);
