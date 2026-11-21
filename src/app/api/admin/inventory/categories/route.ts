import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";

const CatSchema = z.object({ name: z.string().trim().min(2, "Enter a name").max(40) });

export const POST = api(
  async (ctx) => {
    const { name } = await body(ctx.req, CatSchema);
    return tx(async (t) => {
      const { rows } = await t.query<{ id: string }>("insert into inventory_categories (name, sort) values ($1, (select coalesce(max(sort),0)+1 from inventory_categories)) returning id", [name]);
      await audit(t, ctx, "create", "inventory_category", rows[0].id, `Added inventory category ${name}`);
      return rows[0];
    });
  },
  { permission: "inventory.manage" },
);
