import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { GroupSchema, saveGroup } from "@/server/menu-admin";

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, GroupSchema);
    return { id: await tx((t) => saveGroup(t, ctx, null, input)) };
  },
  { permission: "menu.manage" },
);
