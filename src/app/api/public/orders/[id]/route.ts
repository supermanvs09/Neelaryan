import { z } from "zod";
import { api, notFound } from "@/server/http";
import { publicOrder } from "@/server/orders";
import { canAccessOrder } from "@/server/order-access";

/** Live order status for the customer's tracking page. */
export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().safeParse(ctx.params.id);
    if (!id.success) throw notFound("Order");
    const token = ctx.req.headers.get("x-order-token");
    if (!(await canAccessOrder(id.data, token, ctx.customer?.id ?? null))) throw notFound("Order");
    return { order: await publicOrder(id.data) };
  },
  { auth: "public" },
);
