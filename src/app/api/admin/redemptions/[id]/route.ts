import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { cancelRedemption } from "@/server/loyalty";

const Schema = z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "Say why").max(200) });

/** Cancel an unused reward — its points go back to the customer. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { reason } = await body(ctx.req, Schema);
    await tx(async (t) => {
      await cancelRedemption(t, id, ctx.user!.id);
      await audit(t, ctx, "cancel", "redemption", id, "Cancelled a reward and returned its points", { reason });
    });
    return { ok: true };
  },
  { permission: "loyalty.manage" },
);
