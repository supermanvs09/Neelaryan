import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";

const Schema = z.object({ kind: z.enum(["items", "categories", "groups"]), ids: z.array(z.string().uuid()).min(1).max(500) });
const TABLE = { items: "menu_items", categories: "menu_categories", groups: "modifier_groups" } as const;

/** Saves display order (the customer menu shows things in this order). */
export const POST = api(
  async (ctx) => {
    const { kind, ids } = await body(ctx.req, Schema);
    await tx(async (t) => {
      for (const [i, id] of ids.entries()) await t.query(`update ${TABLE[kind]} set sort = $2 where id = $1`, [id, i]);
      await audit(t, ctx, "reorder", kind, null, `Changed the display order of ${kind}`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
