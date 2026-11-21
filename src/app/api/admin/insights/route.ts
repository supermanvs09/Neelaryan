import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { menuSales } from "@/server/analytics";
import { menuEngineering } from "@/lib/analytics";

const Query = z
  .object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
  .refine((v) => v.from <= v.to, { message: "The start date must be before the end date.", path: ["from"] });

/** Menu engineering: Stars, Popular-low-profit, Profitable-but-rare, Weak sellers. */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const { sold, unsold } = await menuSales(f.from, f.to);
    return menuEngineering(sold, unsold);
  },
  { permission: ["reports.view", "finance.view"] },
);
