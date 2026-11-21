import { z } from "zod";
import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { verifyOtp } from "@/server/customers/otp";
import { claimOrder, withCustomerSession } from "@/server/customers/account";
import { rateLimit } from "@/server/ratelimit";

const Schema = z.object({
  challenge_id: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  /** the order the guest just placed — linked to their account on sign-in */
  claim: z.object({ order_id: z.string().uuid(), access_token: z.string().min(32).max(100) }).nullable().optional(),
});

/**
 * Checks the code. Existing customer → signed in (cookie). New customer → a one-time
 * sign-up token for the profile step.
 */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    if (ctx.ip) await rateLimit(`otp-verify:ip:${ctx.ip}`, 30, 3600);
    const v = await verifyOtp(input.challenge_id, input.code);
    if (!v.customerId) return { needs_profile: true, signup_token: v.signupToken, channel: v.channel, destination: v.destination };
    let claimed = null;
    if (input.claim) {
      claimed = await tx((t) => claimOrder(t, input.claim!.order_id, input.claim!.access_token, v.customerId!)).catch(() => null);
    }
    return withCustomerSession(v.customerId, { signed_in: true, claimed });
  },
  { auth: "public" },
);
