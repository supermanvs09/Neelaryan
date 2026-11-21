import { z } from "zod";
import { api, notFound } from "@/server/http";
import { orderDetail } from "@/server/orders";

export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().safeParse(ctx.params.id);
    if (!id.success) throw notFound("Order");
    const order = await orderDetail(id.data);
    if (!order) throw notFound("Order");
    // unit costs are financial data: only for people who can see finance
    if (!ctx.user!.permissions.includes("finance.view")) for (const i of order.items as { unit_cost?: unknown }[]) delete i.unit_cost;
    return { order };
  },
  { permission: ["orders.view", "kitchen.view"] },
);
