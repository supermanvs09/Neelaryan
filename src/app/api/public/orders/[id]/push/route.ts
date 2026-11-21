import { z } from "zod";
import { api, body, bad, notFound } from "@/server/http";
import { q } from "@/server/db";
import { canAccessOrder } from "@/server/order-access";
import { pushEnabled } from "@/server/push";
import { PushSubscriptionSchema } from "@/server/push-schema";

const Schema = z.object({ subscription: PushSubscriptionSchema, lang: z.enum(["en", "hi", "te"]).default("en") });

/** "Notify me when it's ready" for one order. */
export const POST = api(
  async (ctx) => {
    if (!pushEnabled()) throw bad("Notifications aren't available.");
    const id = z.string().uuid().parse(ctx.params.id);
    if (!(await canAccessOrder(id, ctx.req.headers.get("x-order-token"), ctx.customer?.id ?? null))) throw notFound("Order");
    const { subscription: s, lang } = await body(ctx.req, Schema);
    await q(
      `insert into push_subscriptions (endpoint, p256dh, auth, lang, order_id) values ($1,$2,$3,$4,$5)
       on conflict (endpoint, order_id) where order_id is not null do update set p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang`,
      [s.endpoint, s.keys.p256dh, s.keys.auth, lang, id],
    );
    return { ok: true };
  },
  { auth: "public" },
);
