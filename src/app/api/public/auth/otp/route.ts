import { z } from "zod";
import { api, body } from "@/server/http";
import { requestOtp } from "@/server/customers/otp";

const Schema = z.object({
  channel: z.enum(["sms", "email"]).default("sms"),
  destination: z.string().trim().min(3).max(120),
});

/** Sends a sign-in code. The same flow signs in existing customers and verifies new ones. */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    return requestOtp({ ...input, ip: ctx.ip });
  },
  { auth: "public" },
);
