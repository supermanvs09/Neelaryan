import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { q, type Queryable } from "../db";
import { bad, conflict, notFound } from "../http";
import { getSetting } from "../settings";
import { earnForOrder, grantPoints, maxPointsDiscount } from "../loyalty";
import { createCustomerSession, CUSTOMER_COOKIE, CUSTOMER_SESSION_DAYS } from "./session";
import { cookieOptions, sha256 } from "../auth/session";
import { timingSafeEqual } from "node:crypto";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const ProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(40),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email")]).default(""),
  dob: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")])
    .default("")
    .refine((d) => !d || (d >= "1920-01-01" && d <= today()), "Enter a valid date of birth"),
  marketing_consent: z.boolean().default(false),
});

/** Signs the customer in: a session cookie on the response. */
export async function withCustomerSession(customerId: string, payload: Record<string, unknown>) {
  const token = await createCustomerSession(customerId);
  const res = NextResponse.json(payload);
  res.cookies.set(CUSTOMER_COOKIE, token, cookieOptions(CUSTOMER_SESSION_DAYS * 86400));
  return res;
}

export async function createCustomer(
  db: Queryable,
  input: z.infer<typeof ProfileSchema> & { phone: string | null; emailVerified?: boolean; phoneVerified?: boolean; source: "self" | "staff"; consentSource: string; notes?: string },
) {
  if (input.email) {
    const dup = await db.query("select 1 from customers where lower(email) = $1", [input.email]);
    if (dup.rows.length) throw conflict("That email is already linked to another account.");
  }
  const { rows } = await db.query<{ id: string }>(
    `insert into customers (name, phone, email, dob, phone_verified_at, email_verified_at, marketing_consent, consent_at, consent_source, source, notes)
     values ($1,$2,$3,$4, case when $5 then now() end, case when $6 then now() end, $7, case when $7 then now() end, $8, $9, $10) returning id`,
    [input.name, input.phone, input.email || null, input.dob || null, !!input.phoneVerified, !!input.emailVerified, input.marketing_consent, input.marketing_consent ? input.consentSource : "", input.source, input.notes ?? ""],
  );
  const id = rows[0].id;
  const s = await getSetting("loyalty", db);
  if (s.enabled && s.welcome_bonus > 0) await grantPoints(db, id, s.welcome_bonus, { kind: "promo", note: "Welcome bonus" });
  return id;
}

/** Links an order the guest placed (proved by its device token) to their account; earns points if already completed. */
export async function claimOrder(db: Queryable, orderId: string, accessToken: string, customerId: string) {
  const { rows } = await db.query<{ id: string; customer_id: string | null; access_hash: string | null; status: string; total: number }>(
    "select id, customer_id, access_hash, status, total from orders where id = $1 for update",
    [orderId],
  );
  const o = rows[0];
  if (!o || !o.access_hash) throw notFound("Order");
  const a = Buffer.from(sha256(accessToken));
  const b = Buffer.from(o.access_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw notFound("Order");
  if (o.customer_id === customerId) return { claimed: false, points: 0 };
  if (o.customer_id) throw conflict("This order is already linked to another account.");
  await db.query("update orders set customer_id = $2 where id = $1", [o.id, customerId]);
  let points = 0;
  if (o.status === "completed") {
    await db.query("update customers set visits = visits + 1, total_spent = total_spent + $2, last_order_at = now() where id = $1", [customerId, o.total]);
    points = await earnForOrder(db, o.id);
  }
  return { claimed: true, points };
}

/** Everything the customer's account page shows. */
export async function customerProfile(customerId: string) {
  const [c, history, redemptions, rewards, expiring, loyalty] = await Promise.all([
    q<{ id: string; name: string; phone: string | null; email: string | null; dob: string | null; marketing_consent: boolean; points_balance: number; lifetime_points: number; visits: number; created_at: string }>(
      "select id, name, phone, email, dob::text, marketing_consent, points_balance, lifetime_points, visits, created_at from customers where id = $1",
      [customerId],
    ),
    q("select kind, points, note, created_at, expires_at from point_transactions where customer_id = $1 order by created_at desc, id desc limit 50", [customerId]),
    q(
      `select d.id, d.code, d.status, d.points, d.expires_at, d.used_at, d.created_at, r.name, r.description
         from redemptions d join rewards r on r.id = d.reward_id where d.customer_id = $1 order by d.created_at desc limit 30`,
      [customerId],
    ),
    publicRewards(),
    q<{ points: number; expires_at: string }>(
      "select sum(remaining)::int as points, min(expires_at) as expires_at from point_transactions where customer_id = $1 and remaining > 0 and expires_at is not null and expires_at < now() + interval '30 days'",
      [customerId],
    ),
    getSetting("loyalty"),
  ]);
  if (!c.rows[0]) throw notFound("Account");
  const orders = await q(
    `select o.id, o.number, o.type, o.status, o.total, o.created_at, t.label as table_label,
            (select coalesce(pt.points,0) from point_transactions pt where pt.order_id = o.id and pt.kind = 'earn') as points_earned,
            (select string_agg(i.qty || ' × ' || i.name, ', ' order by i.id) from order_items i where i.order_id = o.id) as items
       from orders o left join dining_tables t on t.id = o.table_id where o.customer_id = $1 order by o.created_at desc limit 20`,
    [customerId],
  );
  return {
    customer: c.rows[0],
    points: { balance: c.rows[0].points_balance, value: Math.floor(c.rows[0].points_balance * loyalty.point_value * 100) / 100, expiring: expiring.rows[0]?.points ? expiring.rows[0] : null },
    loyalty: { enabled: loyalty.enabled, points_per_100: loyalty.points_per_100, point_value: loyalty.point_value, min_redeem_points: loyalty.min_redeem_points, max_redeem_percent: loyalty.max_redeem_percent, min_order_amount: loyalty.min_order_amount },
    history: history.rows,
    redemptions: redemptions.rows,
    rewards,
    orders: orders.rows,
  };
}

export async function publicRewards() {
  const { rows } = await q<{ id: string; name: string; description: string; points_cost: number; kind: string; value: number | null; min_order: number; menu_item: string | null; left: number | null; valid_to: string | null }>(
    `select r.id, r.name, r.description, r.points_cost, r.kind, r.value, r.min_order, m.name as menu_item,
            case when r.quantity_total is null then null else greatest(0, r.quantity_total - r.quantity_redeemed) end as left, r.valid_to::text
       from rewards r left join menu_items m on m.id = r.menu_item_id
      where r.is_active and (r.valid_from is null or r.valid_from <= (now() at time zone 'Asia/Kolkata')::date)
        and (r.valid_to is null or r.valid_to >= (now() at time zone 'Asia/Kolkata')::date)
      order by r.sort, r.points_cost`,
  );
  return rows;
}

/** Points the signed-in customer could use on a bill of this subtotal. */
export async function pointsQuote(customerId: string, subtotal: number) {
  const [c, s] = await Promise.all([q<{ points_balance: number }>("select points_balance from customers where id = $1", [customerId]), getSetting("loyalty")]);
  if (!c.rows[0]) throw bad("Sign in again.");
  return maxPointsDiscount(subtotal, c.rows[0].points_balance, s);
}
