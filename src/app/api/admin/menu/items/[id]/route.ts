import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { ItemSchema, saveItem } from "@/server/menu-admin";
import { audit } from "@/server/audit";

const id = z.string().uuid();

export const PATCH = api(
  async (ctx) => {
    const input = await body(ctx.req, ItemSchema);
    await tx((t) => saveItem(t, ctx, id.parse(ctx.params.id), input));
    return { ok: true };
  },
  { permission: "menu.manage" },
);

/** Items are deactivated, never deleted: past orders and reports keep referring to them. */
export const DELETE = api(
  async (ctx) => {
    const itemId = id.parse(ctx.params.id);
    await tx(async (t) => {
      const { rows } = await t.query<{ name: string }>("update menu_items set is_active = false, updated_at = now() where id = $1 and is_active returning name", [itemId]);
      if (!rows[0]) throw notFound("Menu item");
      await audit(t, ctx, "delete", "menu_item", itemId, `Removed menu item “${rows[0].name}”`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
