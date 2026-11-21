import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { ItemSchema, saveItem } from "@/server/menu-admin";

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, ItemSchema);
    const id = await tx((t) => saveItem(t, ctx, null, input));
    return { id };
  },
  { permission: "menu.manage" },
);
