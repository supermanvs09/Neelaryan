import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";

const Schema = z.object({ status: z.enum(["available", "sold_out", "hidden"]) });
const LABEL = { available: "available", sold_out: "sold out", hidden: "hidden" } as const;

/** Quick availability switch (sold out / available / hidden). Kitchen-safe. */
export const POST = api(
  async (ctx) => {
    const { status } = await body(ctx.req, Schema);
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const { rows } = await t.query<{ name: string }>("update menu_items set status = $2, updated_at = now() where id = $1 and is_active returning name", [id, status]);
      if (!rows[0]) throw notFound("Menu item");
      await audit(t, ctx, "availability", "menu_item", id, `Marked “${rows[0].name}” ${LABEL[status]}`);
    });
    return { ok: true };
  },
  { permission: "menu.manage" },
);
