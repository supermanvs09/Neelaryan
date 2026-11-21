import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { CategorySchema, saveCategory } from "@/server/menu-admin";

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, CategorySchema);
    return { id: await tx((t) => saveCategory(t, ctx, null, input)) };
  },
  { permission: "menu.manage" },
);
