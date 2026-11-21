import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { GroupSchema, saveGroup } from "@/server/menu-admin";
import { audit } from "@/server/audit";

export const PATCH = api(
  async (ctx) => {
    const input = await body(ctx.req, GroupSchema);
    await tx((t) => saveGroup(t, ctx, z.string().uuid().parse(ctx.params.id), input));
    return { ok: true };
  },
  { permission: "menu.manage" },
);

/** Switches the group off everywhere (it disappears from every item's customiser). */
export const DELETE = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const { rows } = await t.query<{ name: string }>("update modifier_groups set is_active = false where id = $1 returning name", [id]);
      await t.query("delete from item_modifier_groups where group_id = $1", [id]);
      await audit(t, ctx, "delete", "modifier_group", id, `Removed add-on group “${rows[0]?.name ?? ""}”`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
