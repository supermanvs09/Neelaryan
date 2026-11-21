import { api, body } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { RewardSchema } from "@/server/rewards";

export const GET = api(
  async () => {
    const { rows } = await q(
      `select r.*, r.valid_from::text, r.valid_to::text, m.name as menu_item,
              (select count(*)::int from redemptions d where d.reward_id = r.id and d.status = 'used') as used,
              (select count(*)::int from redemptions d where d.reward_id = r.id and d.status = 'issued' and d.expires_at > now()) as open
         from rewards r left join menu_items m on m.id = r.menu_item_id order by r.is_active desc, r.sort, r.points_cost`,
    );
    return { rewards: rows };
  },
  { permission: ["loyalty.manage", "customers.view", "billing.manage"] },
);

export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, RewardSchema);
    return tx(async (t) => {
      const { rows } = await t.query<{ id: string }>(
        `insert into rewards (name, description, points_cost, kind, menu_item_id, value, min_order, valid_from, valid_to, quantity_total, redemption_valid_days, is_active, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,(select coalesce(max(sort),0)+1 from rewards)) returning id`,
        [v.name, v.description, v.points_cost, v.kind, v.kind === "free_item" ? v.menu_item_id : null, v.kind.startsWith("discount") ? v.value : null, v.min_order, v.valid_from, v.valid_to, v.quantity_total, v.redemption_valid_days, v.is_active],
      );
      await audit(t, ctx, "create", "reward", rows[0].id, `Created reward ${v.name} (${v.points_cost} points)`, v);
      return rows[0];
    });
  },
  { permission: "loyalty.manage" },
);
