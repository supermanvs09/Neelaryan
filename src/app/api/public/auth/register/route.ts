import { z } from "zod";
import { api, body, bad } from "@/server/http";
import { tx } from "@/server/db";
import { consumeSignupToken } from "@/server/customers/otp";
import { ProfileSchema, claimOrder, createCustomer, withCustomerSession } from "@/server/customers/account";

const Schema = ProfileSchema.extend({
  signup_token: z.string().min(20).max(100),
  claim: z.object({ order_id: z.string().uuid(), access_token: z.string().min(32).max(100) }).nullable().optional(),
});

/** Completes sign-up after the mobile number (or email) was verified by code. */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    const r = await tx(async (t) => {
      const v = await consumeSignupToken(t, input.signup_token);
      if (v.channel === "email" && input.email && input.email !== v.destination) throw bad("Use the email address you verified.");
      const id = await createCustomer(t, {
        ...input,
        phone: v.channel === "sms" ? v.destination : null,
        email: v.channel === "email" ? v.destination : input.email,
        phoneVerified: v.channel === "sms",
        emailVerified: v.channel === "email",
        source: "self",
        consentSource: "Sign-up form (customer ticked the box)",
      });
      const claimed = input.claim ? await claimOrder(t, input.claim.order_id, input.claim.access_token, id).catch(() => null) : null;
      return { id, claimed };
    });
    return withCustomerSession(r.id, { signed_in: true, claimed: r.claimed });
  },
  { auth: "public" },
);
