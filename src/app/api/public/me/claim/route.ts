import { z } from "zod";
import { api, body, ApiError } from "@/server/http";
import { tx } from "@/server/db";
import { claimOrder } from "@/server/customers/account";

const Schema = z.object({ order_id: z.string().uuid(), access_token: z.string().min(32).max(100) });

/** Adds an order placed on this device to the signed-in account (earns its points). */
export const POST = api(
  async (ctx) => {
    if (!ctx.customer) throw new ApiError(401, "Please sign in.", "UNAUTHENTICATED");
    const input = await body(ctx.req, Schema);
    return tx((t) => claimOrder(t, input.order_id, input.access_token, ctx.customer!.id));
  },
  { auth: "public" },
);
