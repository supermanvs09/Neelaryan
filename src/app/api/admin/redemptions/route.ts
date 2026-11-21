import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { q } from "@/server/db";

const Query = z.object({
  status: z.enum(["issued", "used", "expired", "cancelled"]).optional(),
  code: z.string().trim().max(20).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Redemption history; look up a code a customer shows at the counter. */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (f.status) where.push(`d.status = $${params.push(f.status)}`);
    if (f.code) where.push(`upper(d.code) = upper($${params.push(f.code.startsWith("NR-") || f.code.startsWith("nr-") ? f.code : `NR-${f.code}`)})`);
    const { rows } = await q(
      `select d.id, d.code, d.status, d.points, d.expires_at, d.used_at, d.created_at, r.name as reward, r.kind, r.value, m.name as menu_item,
              c.id as customer_id, c.name as customer, c.phone, o.number as order_number,
              (d.status = 'issued' and d.expires_at <= now()) as lapsed
         from redemptions d join rewards r on r.id = d.reward_id join customers c on c.id = d.customer_id
         left join menu_items m on m.id = r.menu_item_id left join orders o on o.id = d.order_id
        ${where.length ? `where ${where.join(" and ")}` : ""} order by d.created_at desc limit ${f.limit}`,
      params,
    );
    return { redemptions: rows };
  },
  { permission: ["loyalty.manage", "customers.view", "billing.manage"] },
);
