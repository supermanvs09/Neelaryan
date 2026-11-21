import { z } from "zod";
import { api, body } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { getSetting, setSetting } from "@/server/settings";

const date = z.union([z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
const Schema = z
  .object({
    enabled: z.boolean(),
    points_per_100: z.number().min(0).max(100),
    min_order_amount: z.number().min(0).max(100000),
    point_value: z.number().min(0.01).max(100),
    min_redeem_points: z.number().int().min(1).max(100000),
    max_redeem_percent: z.number().min(1).max(100),
    expiry_months: z.number().int().min(0).max(60),
    welcome_bonus: z.number().int().min(0).max(10000),
    promo_multiplier: z.number().min(1).max(10),
    promo_from: date,
    promo_to: date,
  })
  .refine((v) => !v.promo_from || !v.promo_to || v.promo_from <= v.promo_to, { message: "The promotion must end after it starts.", path: ["promo_to"] })
  .refine((v) => v.promo_multiplier <= 1 || (v.promo_from && v.promo_to), { message: "Set the dates for the bonus points promotion.", path: ["promo_from"] });

export const GET = api(
  async () => {
    const [settings, stats] = await Promise.all([
      getSetting("loyalty"),
      q(
        `select (select count(*)::int from customers where is_active) as members,
                (select coalesce(sum(points_balance),0)::int from customers where is_active) as outstanding,
                (select coalesce(sum(points),0)::int from point_transactions where kind in ('earn','promo') and created_at > now() - interval '30 days') as earned_30d,
                (select coalesce(-sum(points),0)::int from point_transactions where kind = 'redeem' and created_at > now() - interval '30 days') as redeemed_30d,
                (select count(*)::int from redemptions where status = 'issued' and expires_at > now()) as open_rewards`,
      ),
    ]);
    const st = stats.rows[0] as { outstanding: number };
    return { settings, stats: { ...stats.rows[0], liability: Math.round(st.outstanding * settings.point_value * 100) / 100 } };
  },
  { permission: ["loyalty.manage", "customers.view"] },
);

export const PUT = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    await tx(async (t) => {
      const before = await getSetting("loyalty", t);
      await setSetting(t, "loyalty", input);
      await audit(t, ctx, "update", "settings", "loyalty", "Updated loyalty programme settings", diff(before as unknown as Record<string, unknown>, input));
    });
    return { ok: true };
  },
  { permission: "loyalty.manage" },
);
