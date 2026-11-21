import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { canAccessOrder } from "@/server/order-access";
import { leaveFeedback } from "@/server/service";
import { rateLimit } from "@/server/ratelimit";

const Schema = z.object({
  rating: z.number().int().min(1, "Choose 1 to 5 stars").max(5),
  comment: z.string().trim().max(300).optional(),
});

/** Rate the order (1–5 stars + optional comment) after it's served. Editable for 3 days. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    if (!(await canAccessOrder(id, ctx.req.headers.get("x-order-token"), ctx.customer?.id ?? null))) throw notFound("Order");
    await rateLimit(`feedback:${id}`, 10, 3600);
    const v = await body(ctx.req, Schema);
    await tx((t) => leaveFeedback(t, id, v.rating, v.comment ?? null));
    return { ok: true };
  },
  { auth: "public" },
);
