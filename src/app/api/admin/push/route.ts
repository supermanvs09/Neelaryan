import { z } from "zod";
import { api, body, bad } from "@/server/http";
import { q } from "@/server/db";
import { pushEnabled, pushPublicKey } from "@/server/push";
import { PushSubscriptionSchema } from "@/server/push-schema";

/** Is this device subscribed? (and the key to subscribe with) */
export const GET = api(
  async (ctx) => {
    const endpoint = ctx.req.nextUrl.searchParams.get("endpoint");
    const on = endpoint ? (await q("select 1 from push_subscriptions where endpoint = $1 and user_id = $2", [endpoint, ctx.user!.id])).rows.length > 0 : false;
    return { key: pushPublicKey(), subscribed: on };
  },
  { permission: ["orders.view", "kitchen.view"] },
);

/** New-order, UPI and table-request alerts on this device, even when locked. */
export const POST = api(
  async (ctx) => {
    if (!pushEnabled()) throw bad("Notifications aren't set up on the server (VAPID keys).");
    const { subscription: s } = await body(ctx.req, z.object({ subscription: PushSubscriptionSchema }));
    await q(
      `insert into push_subscriptions (endpoint, p256dh, auth, user_id) values ($1,$2,$3,$4)
       on conflict (endpoint) where user_id is not null do update set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id`,
      [s.endpoint, s.keys.p256dh, s.keys.auth, ctx.user!.id],
    );
    return { ok: true };
  },
  { permission: ["orders.view", "kitchen.view"] },
);

export const DELETE = api(
  async (ctx) => {
    const { endpoint } = await body(ctx.req, z.object({ endpoint: z.string().url().max(1000) }));
    await q("delete from push_subscriptions where endpoint = $1 and user_id = $2", [endpoint, ctx.user!.id]);
    return { ok: true };
  },
  { permission: ["orders.view", "kitchen.view"] },
);
