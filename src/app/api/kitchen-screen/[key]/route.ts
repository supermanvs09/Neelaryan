import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { api, body, ApiError, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { getSetting } from "@/server/settings";
import { kitchenFeed } from "@/server/kitchen";
import { transition } from "@/server/orders";
import { rateLimit } from "@/server/ratelimit";
import { notifyLater, pushOrderReady } from "@/server/push";

async function check(key: string | undefined, ip: string | null) {
  await rateLimit(`kitchen-link:${ip ?? "?"}`, 300, 600);
  const k = await getSetting("kitchen");
  const a = Buffer.from(key ?? "");
  const b = Buffer.from(k.link_token ?? "");
  if (!k.link_enabled || !b.length || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(404, "This kitchen link isn't active. Ask the owner for the current link.", "NOT_FOUND");
}

/** Kitchen board for the secret link: no prices, no phone numbers. */
export const GET = api(
  async (ctx) => {
    await check(ctx.params.key, ctx.ip);
    return kitchenFeed();
  },
  { auth: "public" },
);

const Schema = z.object({ order_id: z.string().uuid(), to: z.enum(["accepted", "preparing", "ready"]) });

/** Cooks can only move food forward: accept → preparing → ready. */
export const POST = api(
  async (ctx) => {
    await check(ctx.params.key, ctx.ip);
    const { order_id, to } = await body(ctx.req, Schema);
    const o = await tx((t) => transition(t, order_id, to, { userId: null, permissions: ["kitchen.update"], reason: undefined })).catch((e) => {
      if (e instanceof ApiError && e.status === 404) throw notFound("Order");
      throw e;
    });
    if (to === "ready") notifyLater(() => pushOrderReady(order_id));
    return { ok: true, status: o.status };
  },
  { auth: "public" },
);
