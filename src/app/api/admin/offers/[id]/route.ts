import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { OfferSchema } from "@/server/offers-admin";

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const v = await body(ctx.req, OfferSchema);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown>>(
        "select title, percent_off, menu_item_ids, days::int[] as days, to_char(starts_at,'HH24:MI') as starts_at, valid_from::text, valid_to::text, is_active from offers where id = $1 for update",
        [id],
      )).rows[0];
      if (!before) throw notFound("Offer");
      await t.query(
        "update offers set title=$2, percent_off=$3, menu_item_ids=$4, days=$5, starts_at=$6, ends_at=$7, valid_from=$8, valid_to=$9, is_active=$10, updated_at=now() where id=$1",
        [id, v.title, v.percent_off, v.menu_item_ids, v.days, v.starts_at, v.ends_at, v.valid_from, v.valid_to, v.is_active],
      );
      await audit(t, ctx, "update", "offer", id, `Updated offer “${v.title}”`, diff(before, v));
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);

/** Orders keep their recorded discount; deleting only stops future use. */
export const DELETE = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const { rows } = await t.query<{ title: string }>("delete from offers where id = $1 returning title", [id]);
      if (!rows[0]) throw notFound("Offer");
      await audit(t, ctx, "delete", "offer", id, `Deleted offer “${rows[0].title}”`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
