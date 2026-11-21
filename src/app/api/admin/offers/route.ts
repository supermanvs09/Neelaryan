import { api, body, bad } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { OfferSchema } from "@/server/offers-admin";
import { offerStats } from "@/server/analytics";
import { cafeClock } from "@/lib/offers";

/** Offers with their results over the last 30 days. */
export const GET = api(
  async () => {
    const today = cafeClock().date;
    const from = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
    const [rows, stats] = await Promise.all([
      q<{ id: string } & Record<string, unknown>>(
        `select id, title, percent_off, menu_item_ids, days::int[] as days, to_char(starts_at, 'HH24:MI') as starts_at,
                case when ends_at = '24:00'::time then '24:00' else to_char(ends_at, 'HH24:MI') end as ends_at,
                valid_from::text, valid_to::text, is_active, created_at
           from offers order by is_active desc, created_at desc`,
      ),
      offerStats(from, today),
    ]);
    return { offers: rows.rows.map((o) => ({ ...o, stats: stats.get(o.id) ?? { orders: 0, units: 0, discount: 0 } })) };
  },
  { permission: ["menu.view", "reports.view"] },
);

export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, OfferSchema);
    return tx(async (t) => {
      if (v.menu_item_ids.length) {
        const { rows } = await t.query<{ n: number }>("select count(*)::int as n from menu_items where id = any($1::uuid[]) and is_active", [v.menu_item_ids]);
        if (rows[0].n !== new Set(v.menu_item_ids).size) throw bad("An item in this offer is no longer on the menu.");
      }
      const { rows } = await t.query<{ id: string }>(
        `insert into offers (title, percent_off, menu_item_ids, days, starts_at, ends_at, valid_from, valid_to, is_active, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [v.title, v.percent_off, v.menu_item_ids, v.days, v.starts_at, v.ends_at, v.valid_from, v.valid_to, v.is_active, ctx.user!.id],
      );
      await audit(t, ctx, "create", "offer", rows[0].id, `Created offer “${v.title}” (${v.percent_off}% off)`, v);
      return rows[0];
    });
  },
  { permission: "menu.manage" },
);
