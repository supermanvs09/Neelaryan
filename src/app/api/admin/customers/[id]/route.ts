import { z } from "zod";
import { api, body, conflict, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit, diff } from "@/server/audit";

export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { rows } = await q(
      `select c.id, c.name, c.phone, c.email, c.dob::text, c.marketing_consent, c.consent_at, c.consent_source, c.unsubscribed_at, c.points_balance, c.lifetime_points,
              c.visits, c.total_spent, c.last_order_at, c.created_at, c.notes, c.is_active, c.source,
              c.phone_verified_at, c.email_verified_at
         from customers c where c.id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound("Customer");
    const [orders, points, redemptions, messages] = await Promise.all([
      q(
        `select o.id, o.number, o.type, o.status, o.payment_status, o.total, o.created_at, t.label as table_label
           from orders o left join dining_tables t on t.id = o.table_id where o.customer_id = $1 order by o.created_at desc limit 50`,
        [id],
      ),
      q(
        `select p.id, p.kind, p.points, p.remaining, p.note, p.expires_at, p.created_at, o.number as order_number, u.name as by
           from point_transactions p left join orders o on o.id = p.order_id left join users u on u.id = p.created_by
          where p.customer_id = $1 order by p.created_at desc, p.id desc limit 100`,
        [id],
      ),
      q(
        `select d.id, d.code, d.status, d.points, d.expires_at, d.used_at, d.created_at, r.name, o.number as order_number
           from redemptions d join rewards r on r.id = d.reward_id left join orders o on o.id = d.order_id where d.customer_id = $1 order by d.created_at desc`,
        [id],
      ),
      q("select id, kind, channel, subject, status, created_at, sent_at from notifications where customer_id = $1 order by created_at desc limit 30", [id]),
    ]);
    return { customer: rows[0], orders: orders.rows, points: points.rows, redemptions: redemptions.rows, messages: messages.rows };
  },
  { permission: "customers.view" },
);

const Schema = z.object({
  name: z.string().trim().min(2).max(40),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).default(""),
  dob: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  notes: z.string().trim().max(500).default(""),
  /** staff may only withdraw consent (e.g. customer asked in person); opting in is the customer's choice */
  withdraw_consent: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, Schema);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown>>("select name, email, dob::text, notes, is_active, marketing_consent from customers where id = $1 for update", [id])).rows[0];
      if (!before) throw notFound("Customer");
      if (input.email && input.email !== before.email) {
        const dup = await t.query("select 1 from customers where lower(email) = $1 and id <> $2", [input.email, id]);
        if (dup.rows.length) throw conflict("That email belongs to another customer.");
      }
      await t.query(
        `update customers set name=$2, email=$3, dob=$4, notes=$5, is_active=$6,
                email_verified_at = case when coalesce(email,'') <> $3 then null else email_verified_at end,
                marketing_consent = marketing_consent and not $7,
                unsubscribed_at = case when $7 and marketing_consent then now() else unsubscribed_at end,
                updated_at = now()
          where id=$1`,
        [id, input.name, input.email || null, input.dob || null, input.notes, input.is_active, input.withdraw_consent],
      );
      const { withdraw_consent, ...rest } = input;
      await audit(t, ctx, "update", "customer", id, `Updated customer ${input.name}${withdraw_consent ? " (marketing consent withdrawn)" : ""}`, diff(before, { ...rest, email: rest.email || null, dob: rest.dob || null }));
    });
    return { ok: true };
  },
  { permission: "customers.manage" },
);
