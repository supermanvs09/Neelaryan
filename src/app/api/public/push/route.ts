import { z } from "zod";
import { api, body } from "@/server/http";
import { q } from "@/server/db";
import { pushPublicKey } from "@/server/push";

/** Public key for subscribing (null = push isn't configured, hide the buttons). */
export const GET = api(async () => ({ key: pushPublicKey() }), { auth: "public" });

const Schema = z.object({ endpoint: z.string().url().max(1000) });

/** Stop notifications on this device for guest orders. */
export const DELETE = api(
  async (ctx) => {
    const { endpoint } = await body(ctx.req, Schema);
    await q("delete from push_subscriptions where endpoint = $1 and order_id is not null", [endpoint]);
    return { ok: true };
  },
  { auth: "public" },
);
