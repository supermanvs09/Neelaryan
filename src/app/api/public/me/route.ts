import { api, body, ApiError, conflict } from "@/server/http";
import { tx } from "@/server/db";
import { ProfileSchema, customerProfile } from "@/server/customers/account";

const signedIn = (c: unknown) => {
  if (!c) throw new ApiError(401, "Please sign in.", "UNAUTHENTICATED");
};

/** The signed-in customer's account. 200 with { customer: null } when signed out. */
export const GET = api(
  async (ctx) => {
    if (!ctx.customer) return { customer: null };
    return customerProfile(ctx.customer.id);
  },
  { auth: "public" },
);

/** Edit profile. Date of birth can be set once (it drives birthday rewards). */
export const PATCH = api(
  async (ctx) => {
    signedIn(ctx.customer);
    const input = await body(ctx.req, ProfileSchema);
    await tx(async (t) => {
      const { rows } = await t.query<{ dob: string | null; email: string | null; marketing_consent: boolean }>("select dob::text, email, marketing_consent from customers where id = $1 for update", [ctx.customer!.id]);
      const c = rows[0];
      if (c.dob && input.dob && input.dob !== c.dob) throw conflict("Your date of birth can't be changed here. Please ask our team.");
      const emailChanged = (input.email || null) !== c.email;
      if (emailChanged && input.email) {
        const dup = await t.query("select 1 from customers where lower(email) = $1 and id <> $2", [input.email, ctx.customer!.id]);
        if (dup.rows.length) throw conflict("That email is already linked to another account.");
      }
      await t.query(
        `update customers set name = $2, email = $3, dob = coalesce(dob, $4::date),
                email_verified_at = case when $5 then null else email_verified_at end,
                marketing_consent = $6,
                consent_at = case when $6 and not marketing_consent then now() else consent_at end,
                consent_source = case when $6 and not marketing_consent then 'Account page (customer ticked the box)' else consent_source end,
                unsubscribed_at = case when not $6 and marketing_consent then now() when $6 then null else unsubscribed_at end,
                updated_at = now()
          where id = $1`,
        [ctx.customer!.id, input.name, input.email || null, input.dob || null, emailChanged, input.marketing_consent],
      );
    });
    return customerProfile(ctx.customer!.id);
  },
  { auth: "public" },
);
