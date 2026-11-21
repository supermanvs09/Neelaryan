import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { q } from "@/server/db";

const Schema = z.object({ token: z.string().min(20).max(80), resubscribe: z.boolean().default(false) });

/** One-click opt-out from marketing messages (link in every promotional message). */
export const POST = api(
  async (ctx) => {
    const { token, resubscribe } = await body(ctx.req, Schema);
    const { rows } = await q<{ name: string }>(
      resubscribe
        ? "update customers set marketing_consent = true, consent_at = now(), consent_source = 'Re-subscribed from unsubscribe page', unsubscribed_at = null where unsubscribe_token = $1 returning name"
        : "update customers set marketing_consent = false, unsubscribed_at = coalesce(unsubscribed_at, now()) where unsubscribe_token = $1 returning name",
      [token],
    );
    if (!rows[0]) throw notFound("Subscription");
    return { ok: true, subscribed: resubscribe };
  },
  { auth: "public" },
);
