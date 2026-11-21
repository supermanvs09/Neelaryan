import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { ingredientUsage, stockItems } from "@/server/analytics";
import { USAGE_WINDOW_DAYS, shoppingList, usageCheck } from "@/lib/analytics";
import { cafeClock } from "@/lib/offers";

const Query = z.object({ cover: z.coerce.number().int().min(1).max(14).default(2) });

/**
 * Shopping list (what to buy to last `cover` days, from the last 14 days of use) and the
 * usage check (expected use vs what stock counts found).
 */
export const GET = api(
  async (ctx) => {
    const { cover } = searchParams(ctx.req, Query);
    const to = cafeClock().date;
    const from = new Date(Date.parse(`${to}T00:00:00Z`) - (USAGE_WINDOW_DAYS - 1) * 86400000).toISOString().slice(0, 10);
    const [items, usage] = await Promise.all([stockItems(), ingredientUsage(from, to)]);
    return { from, to, cover, shopping: shoppingList(items, usage, cover), usage: usageCheck(items, usage) };
  },
  { permission: ["inventory.view", "purchases.manage"] },
);
