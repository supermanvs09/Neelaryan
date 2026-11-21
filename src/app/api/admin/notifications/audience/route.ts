import { z } from "zod";
import { api, body } from "@/server/http";
import { AudienceSchema, audienceCount } from "@/server/messaging/notify";

const Schema = z.object({ audience: AudienceSchema, channel: z.enum(["email", "sms", "whatsapp"]) });

/** How many customers a campaign would reach (only those who opted in and have that contact). */
export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, Schema);
    return audienceCount(v.audience, v.channel);
  },
  { permission: "notifications.manage" },
);
