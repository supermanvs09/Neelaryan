import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";

const Schema = z.object({ name: z.string().trim().min(2, "Enter a name").max(40) });

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { name } = await body(ctx.req, Schema);
    await tx(async (t) => {
      const r = await t.query<{ name: string }>("update inventory_categories set name = $2 where id = $1 returning name", [id, name]);
      if (!r.rows.length) throw notFound("Category");
      await audit(t, ctx, "update", "inventory_category", id, `Renamed inventory category to ${name}`);
    });
    return { ok: true };
  },
  { permission: "inventory.manage" },
);

/** Items in a deleted category simply become uncategorised. */
export const DELETE = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const r = await t.query<{ name: string }>("delete from inventory_categories where id = $1 returning name", [id]);
      if (!r.rows.length) throw notFound("Category");
      await audit(t, ctx, "delete", "inventory_category", id, `Deleted inventory category ${r.rows[0].name}`);
    });
    return { ok: true };
  },
  { permission: "inventory.manage" },
);
