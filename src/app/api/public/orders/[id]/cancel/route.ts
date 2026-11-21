import { z } from "zod";
import { api, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { transition } from "@/server/orders";
import { canAccessOrder } from "@/server/order-access";

/** Guests can cancel only while the order is new and unpaid. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    if (!(await canAccessOrder(id, ctx.req.headers.get("x-order-token"), ctx.customer?.id ?? null))) throw notFound("Order");
    await tx((t) => transition(t, id, "cancelled", { userId: null, permissions: "customer", reason: "Cancelled by the customer" }));
    return { ok: true };
  },
  { auth: "public" },
);
