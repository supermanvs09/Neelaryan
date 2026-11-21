import { z } from "zod";
import { api, body, conflict } from "@/server/http";
import { tx } from "@/server/db";
import { CategorySchema, saveCategory } from "@/server/menu-admin";
import { audit } from "@/server/audit";

export const PATCH = api(
  async (ctx) => {
    const input = await body(ctx.req, CategorySchema);
    await tx((t) => saveCategory(t, ctx, z.string().uuid().parse(ctx.params.id), input));
    return { ok: true };
  },
  { permission: "menu.manage" },
);

/** Only empty categories can be removed; otherwise hide them. */
export const DELETE = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const used = await t.query("select 1 from menu_items where category_id = $1 and is_active limit 1", [id]);
      if (used.rows.length) throw conflict("Move or remove this category's items first, or hide the category instead.");
      const { rows } = await t.query<{ name: string }>("update menu_categories set is_active = false where id = $1 returning name", [id]);
      await audit(t, ctx, "delete", "menu_category", id, `Removed category “${rows[0]?.name ?? ""}”`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
