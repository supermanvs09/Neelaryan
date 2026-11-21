import { z } from "zod";
import { api, ApiError, bad } from "@/server/http";
import { tx } from "@/server/db";
import { issueReward } from "@/server/loyalty";
import { getSetting } from "@/server/settings";
import { rateLimit } from "@/server/ratelimit";

/** Exchanges points for a reward code the customer shows (or enters) when ordering. */
export const POST = api(
  async (ctx) => {
    if (!ctx.customer) throw new ApiError(401, "Please sign in to redeem rewards.", "UNAUTHENTICATED");
    const id = z.string().uuid().parse(ctx.params.id);
    await rateLimit(`redeem:${ctx.customer.id}`, 10, 3600);
    if (!(await getSetting("loyalty")).enabled) throw bad("Rewards are paused right now.");
    return tx((t) => issueReward(t, ctx.customer!.id, id));
  },
  { auth: "public" },
);
