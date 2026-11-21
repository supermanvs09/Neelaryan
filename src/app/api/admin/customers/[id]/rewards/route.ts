import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { issueReward } from "@/server/loyalty";

const Schema = z.object({ reward_id: z.string().uuid() });

/** Redeem points for a reward on the customer's behalf (at the counter). */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { reward_id } = await body(ctx.req, Schema);
    return tx(async (t) => {
      const r = await issueReward(t, id, reward_id);
      await audit(t, ctx, "redeem", "customer", id, `Redeemed ${r.reward} for a customer (code ${r.code})`, { reward_id });
      return r;
    });
  },
  { permission: ["loyalty.manage", "billing.manage"] },
);
