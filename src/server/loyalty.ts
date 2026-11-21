import "server-only";
import { randomInt } from "node:crypto";
import type { Queryable } from "./db";
import { bad, conflict } from "./http";
import { getSetting, type LoyaltySettings } from "./settings";
import { round2 } from "@/lib/pricing";

/**
 * Points ledger.
 *  - Every positive grant is a "lot" with its own expiry; spending consumes lots
 *    first-expiring-first, so expiry is always exact.
 *  - point_transactions has a unique index on (order_id) for kind = 'earn':
 *    an order can never earn twice, even under concurrent requests.
 *  - customers.points_balance is a cached sum kept in the same transaction.
 */

export function promoActive(s: LoyaltySettings, at = new Date()) {
  if (!s.promo_multiplier || s.promo_multiplier <= 1) return false;
  const day = at.toISOString().slice(0, 10);
  if (s.promo_from && day < s.promo_from) return false;
  if (s.promo_to && day > s.promo_to) return false;
  return Boolean(s.promo_from || s.promo_to);
}

/** Points an order of this (pre-tax, post-discount) amount earns. */
export function pointsFor(amount: number, s: LoyaltySettings, at = new Date()) {
  if (!s.enabled || amount < s.min_order_amount) return 0;
  const mult = promoActive(s, at) ? s.promo_multiplier : 1;
  return Math.floor((amount / 100) * s.points_per_100 * mult);
}

/** Largest discount points can give on a bill. */
export function maxPointsDiscount(subtotal: number, balance: number, s: LoyaltySettings) {
  if (!s.enabled || balance < s.min_redeem_points) return { points: 0, value: 0 };
  const capValue = (subtotal * s.max_redeem_percent) / 100;
  const points = Math.min(balance, Math.floor(capValue / s.point_value));
  return { points, value: round2(points * s.point_value) };
}

const expiryFrom = (s: LoyaltySettings) => (s.expiry_months > 0 ? new Date(Date.now() + s.expiry_months * 30.44 * 86400000) : null);

async function lockCustomer(db: Queryable, customerId: string) {
  const { rows } = await db.query<{ id: string; points_balance: number }>("select id, points_balance from customers where id = $1 for update", [customerId]);
  if (!rows[0]) throw bad("That customer no longer exists.");
  return rows[0];
}

export async function grantPoints(
  db: Queryable,
  customerId: string,
  points: number,
  opts: { kind: "earn" | "promo" | "adjust" | "restore"; order_id?: string | null; note?: string; created_by?: string | null; expires_at?: Date | null },
) {
  if (points <= 0) return 0;
  await lockCustomer(db, customerId);
  const s = await getSetting("loyalty", db);
  const exp = opts.expires_at === undefined ? expiryFrom(s) : opts.expires_at;
  const { rowCount } = await db.query(
    `insert into point_transactions (customer_id, kind, points, remaining, order_id, expires_at, note, created_by)
     values ($1,$2,$3,$3,$4,$5,$6,$7)
     on conflict do nothing`,
    [customerId, opts.kind, points, opts.order_id ?? null, exp, opts.note ?? "", opts.created_by ?? null],
  );
  if (!rowCount) return 0; // already earned for this order
  await db.query(
    `update customers set points_balance = points_balance + $2,
       lifetime_points = lifetime_points + case when $3 in ('earn','promo') then $2 else 0 end, updated_at = now() where id = $1`,
    [customerId, points, opts.kind],
  );
  return points;
}

/** Spends points first-expiring-first. Throws if the balance is too low. */
export async function spendPoints(
  db: Queryable,
  customerId: string,
  points: number,
  opts: { kind: "redeem" | "expire" | "reverse" | "adjust"; order_id?: string | null; redemption_id?: string | null; note?: string; created_by?: string | null },
) {
  if (points <= 0) return;
  const c = await lockCustomer(db, customerId);
  if (c.points_balance < points) throw conflict("Not enough points for that.");
  let left = points;
  const { rows: lots } = await db.query<{ id: number; remaining: number }>(
    `select id, remaining from point_transactions
      where customer_id = $1 and remaining > 0 and (expires_at is null or expires_at > now())
      order by expires_at nulls last, id for update`,
    [customerId],
  );
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(left, lot.remaining);
    await db.query("update point_transactions set remaining = remaining - $2 where id = $1", [lot.id, take]);
    left -= take;
  }
  await db.query(
    "insert into point_transactions (customer_id, kind, points, order_id, redemption_id, note, created_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [customerId, opts.kind, -points, opts.order_id ?? null, opts.redemption_id ?? null, opts.note ?? "", opts.created_by ?? null],
  );
  await db.query("update customers set points_balance = points_balance - $2, updated_at = now() where id = $1", [customerId, points]);
}

/** Awarded when an order is completed and paid. Safe to call more than once. */
export async function earnForOrder(db: Queryable, orderId: string) {
  const { rows } = await db.query<{ customer_id: string | null; subtotal: number; discount: number; payment_status: string; number: number }>(
    "select customer_id, subtotal, discount, payment_status, number from orders where id = $1",
    [orderId],
  );
  const o = rows[0];
  if (!o?.customer_id || o.payment_status !== "paid") return 0;
  const s = await getSetting("loyalty", db);
  const pts = pointsFor(Number(o.subtotal) - Number(o.discount), s);
  return grantPoints(db, o.customer_id, pts, { kind: "earn", order_id: orderId, note: `Order #${o.number}` });
}

/** Refund of a completed order: take back what it earned (never below zero). Idempotent. */
export async function reverseEarnForOrder(db: Queryable, orderId: string, userId: string | null) {
  const { rows } = await db.query<{ id: number; customer_id: string; points: number; remaining: number }>(
    "select id, customer_id, points, remaining from point_transactions where order_id = $1 and kind = 'earn'",
    [orderId],
  );
  const earn = rows[0];
  if (!earn) return 0;
  const done = await db.query("select 1 from point_transactions where order_id = $1 and kind = 'reverse'", [orderId]);
  if (done.rows.length) return 0;
  const c = await lockCustomer(db, earn.customer_id);
  const take = Math.min(earn.points, c.points_balance);
  if (take <= 0) return 0;
  // take from this order's own lot first, then FIFO for any part already spent elsewhere
  const fromLot = Math.min(take, earn.remaining);
  if (fromLot > 0) await db.query("update point_transactions set remaining = remaining - $2 where id = $1", [earn.id, fromLot]);
  let left = take - fromLot;
  if (left > 0) {
    const { rows: lots } = await db.query<{ id: number; remaining: number }>(
      "select id, remaining from point_transactions where customer_id = $1 and remaining > 0 order by expires_at nulls last, id for update",
      [earn.customer_id],
    );
    for (const lot of lots) {
      if (left <= 0) break;
      const t = Math.min(left, lot.remaining);
      await db.query("update point_transactions set remaining = remaining - $2 where id = $1", [lot.id, t]);
      left -= t;
    }
  }
  await db.query(
    "insert into point_transactions (customer_id, kind, points, order_id, note, created_by) values ($1,'reverse',$2,$3,'Order refunded',$4)",
    [earn.customer_id, -take, orderId, userId],
  );
  await db.query("update customers set points_balance = points_balance - $2 where id = $1", [earn.customer_id, take]);
  return take;
}

/** Cancelled before completion: give back points and rewards used on the order. */
export async function restoreForOrder(db: Queryable, orderId: string) {
  const { rows } = await db.query<{ customer_id: string; points: number }>(
    "select customer_id, -sum(points)::int as points from point_transactions where order_id = $1 and kind = 'redeem' group by customer_id",
    [orderId],
  );
  for (const r of rows) {
    const restored = await db.query("select 1 from point_transactions where order_id = $1 and kind = 'restore'", [orderId]);
    if (!restored.rows.length && r.points > 0) await grantPoints(db, r.customer_id, r.points, { kind: "restore", order_id: orderId, note: "Order cancelled — points returned" });
  }
  await db.query("update redemptions set status = 'issued', order_id = null, used_at = null where order_id = $1 and status = 'used' and expires_at > now()", [orderId]);
}

/** Daily job: expire lots past their date. */
export async function expirePoints(db: Queryable) {
  const { rows } = await db.query<{ id: number; customer_id: string; remaining: number }>(
    "select id, customer_id, remaining from point_transactions where remaining > 0 and expires_at is not null and expires_at <= now() for update",
  );
  let total = 0;
  for (const lot of rows) {
    await db.query("update point_transactions set remaining = 0 where id = $1", [lot.id]);
    await db.query("insert into point_transactions (customer_id, kind, points, note) values ($1,'expire',$2,'Points expired')", [lot.customer_id, -lot.remaining]);
    await db.query("update customers set points_balance = greatest(0, points_balance - $2) where id = $1", [lot.customer_id, lot.remaining]);
    total += lot.remaining;
  }
  await db.query("update redemptions set status = 'expired' where status = 'issued' and expires_at <= now()");
  return { lots: rows.length, points: total };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newRewardCode = () => "NR-" + Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** Customer exchanges points for a reward: returns the redemption (with its code). */
export async function issueReward(db: Queryable, customerId: string, rewardId: string) {
  const { rows } = await db.query<{
    id: string;
    name: string;
    points_cost: number;
    is_active: boolean;
    valid_from: string | null;
    valid_to: string | null;
    quantity_total: number | null;
    quantity_redeemed: number;
    redemption_valid_days: number;
  }>("select * from rewards where id = $1 for update", [rewardId]);
  const r = rows[0];
  const today = new Date().toISOString().slice(0, 10);
  if (!r || !r.is_active) throw bad("That reward isn't available.");
  if ((r.valid_from && today < r.valid_from) || (r.valid_to && today > r.valid_to)) throw bad("That reward isn't available today.");
  if (r.quantity_total !== null && r.quantity_redeemed >= r.quantity_total) throw conflict("That reward has run out.");
  const code = newRewardCode();
  const { rows: red } = await db.query<{ id: string; code: string; expires_at: string }>(
    `insert into redemptions (code, reward_id, customer_id, points, expires_at)
     values ($1,$2,$3,$4, now() + make_interval(days => $5)) returning id, code, expires_at`,
    [code, r.id, customerId, r.points_cost, r.redemption_valid_days],
  );
  await spendPoints(db, customerId, r.points_cost, { kind: "redeem", redemption_id: red[0].id, note: `Reward: ${r.name}` });
  await db.query("update rewards set quantity_redeemed = quantity_redeemed + 1, updated_at = now() where id = $1", [r.id]);
  return { ...red[0], reward: r.name };
}

/** Cancels an unused redemption and returns its points. */
export async function cancelRedemption(db: Queryable, redemptionId: string, userId: string | null) {
  const { rows } = await db.query<{ id: string; customer_id: string; points: number; status: string; reward_id: string }>(
    "select id, customer_id, points, status, reward_id from redemptions where id = $1 for update",
    [redemptionId],
  );
  const r = rows[0];
  if (!r || r.status !== "issued") throw conflict("Only unused rewards can be cancelled.");
  await db.query("update redemptions set status = 'cancelled' where id = $1", [r.id]);
  await db.query("update rewards set quantity_redeemed = greatest(0, quantity_redeemed - 1) where id = $1", [r.reward_id]);
  await grantPoints(db, r.customer_id, r.points, { kind: "restore", note: "Reward cancelled — points returned", created_by: userId });
}

export interface AppliedRedemption {
  id: string;
  code: string;
  discount: number;
  label: string;
}

/**
 * Validates a reward code for an order and returns the discount it gives.
 * `lines` are the priced order lines (menu item id + unit price + qty).
 */
export async function evaluateRedemption(
  db: Queryable,
  code: string,
  customerId: string | null,
  lines: { menu_item_id: string | null; unit_price: number; qty: number }[],
  subtotal: number,
): Promise<AppliedRedemption> {
  const { rows } = await db.query<{
    id: string;
    code: string;
    status: string;
    customer_id: string;
    expires_at: string;
    name: string;
    kind: string;
    menu_item_id: string | null;
    value: number | null;
    min_order: number;
  }>(
    `select d.id, d.code, d.status, d.customer_id, d.expires_at, r.name, r.kind, r.menu_item_id, r.value, r.min_order
       from redemptions d join rewards r on r.id = d.reward_id where upper(d.code) = upper($1) for update of d`,
    [code.trim()],
  );
  const d = rows[0];
  if (!d) throw bad("That reward code isn't valid.");
  if (customerId && d.customer_id !== customerId) throw bad("That reward code belongs to a different account.");
  if (d.status !== "issued") throw bad(d.status === "used" ? "That reward has already been used." : "That reward code is no longer valid.");
  if (new Date(d.expires_at) <= new Date()) throw bad("That reward has expired.");
  if (subtotal < Number(d.min_order)) throw bad(`This reward needs an order of at least ₹${Number(d.min_order)}.`);
  let discount = 0;
  if (d.kind === "free_item") {
    const line = lines.filter((l) => l.menu_item_id && l.menu_item_id === d.menu_item_id).sort((a, b) => b.unit_price - a.unit_price)[0];
    if (!line) throw bad("Add the free item for this reward to your order first.");
    discount = line.unit_price;
  } else if (d.kind === "discount_amount") discount = Number(d.value ?? 0);
  else if (d.kind === "discount_percent") discount = (subtotal * Number(d.value ?? 0)) / 100;
  return { id: d.id, code: d.code, discount: round2(Math.min(discount, subtotal)), label: d.name };
}

export async function markRedemptionUsed(db: Queryable, redemptionId: string, orderId: string) {
  await db.query("update redemptions set status = 'used', order_id = $2, used_at = now() where id = $1 and status = 'issued'", [redemptionId, orderId]);
}
