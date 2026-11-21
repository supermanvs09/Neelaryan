import "server-only";
import { LAST_PICKUP_MINUTES } from "@/lib/analytics";
import { q, type Queryable } from "./db";
import { bad, conflict, notFound } from "./http";
import { round2 } from "@/lib/pricing";
import { cafeClock } from "@/lib/offers";

/* ── Wait time ─────────────────────────────────────────────────────────────
 * "Ready in about N min": the median of recent kitchen times (order placed or
 * due → ready) plus 2 minutes for every order ahead in the queue. 5–60 min. */
export async function kitchenEta(db: Queryable | null = null) {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run<{ typical: number; samples: number; queue: number }>(
    `with recent as (
       select extract(epoch from (o.ready_at - greatest(o.created_at, coalesce(o.scheduled_for - interval '15 minutes', o.created_at)))) / 60 as mins
         from orders o
        where o.ready_at is not null and o.created_at > now() - interval '14 days'
        order by o.ready_at desc limit 60
     ), typical as (
       select least(greatest(coalesce(round(percentile_cont(0.5) within group (order by mins))::int, 10), 3), 40) as typical, count(*)::int as samples
         from recent where mins > 0 and mins < 120
     ), queue as (
       select count(*)::int as queue from orders o
        where o.status in ('new','accepted','preparing') and (o.scheduled_for is null or o.scheduled_for - interval '15 minutes' <= now())
     )
     select typical.typical, typical.samples, queue.queue from typical, queue`,
  );
  const r = rows[0];
  return { minutes: Math.min(60, Math.max(5, r.typical + Math.max(r.queue - 1, 0) * 2)), queue: r.queue, typical: r.typical, samples: r.samples };
}

/* ── Pre-orders ───────────────────────────────────────────────────────────
 * Pickup later today: at least 15 minutes and at most 12 hours ahead, same café day,
 * on a 15-minute boundary. */
export function validatePickup(iso: string, now = new Date()) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) throw bad("Choose a pickup time.", { scheduled_for: "Invalid time" });
  const ahead = (at.getTime() - now.getTime()) / 60000;
  if (ahead < 15) throw bad("Choose a pickup time at least 15 minutes from now.", { scheduled_for: "Too soon" });
  if (ahead > 12 * 60 || cafeClock(at).date !== cafeClock(now).date) throw bad("Pre-orders are for later today only.", { scheduled_for: "Today only" });
  if (cafeClock(at).minutes % 15 !== 0) throw bad("Choose one of the pickup times shown.", { scheduled_for: "Not a slot" });
  if (cafeClock(at).minutes > LAST_PICKUP_MINUTES) throw bad("The last pickup time is 10:45 pm.", { scheduled_for: "After closing" });
  return at.toISOString();
}

/* ── Call staff from the table ──────────────────────────────────────────── */
export const REQUEST_KINDS = ["water", "cutlery", "clean", "bill", "help"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** A second tap for the same thing returns the open request instead of a new one. */
export async function requestService(db: Queryable, tableToken: string, kind: RequestKind) {
  const { rows: t } = await db.query<{ id: string; label: string }>("select id, label from dining_tables where qr_token = $1 and is_active", [tableToken]);
  if (!t[0]) throw notFound("This table");
  await db.query("select pg_advisory_xact_lock(hashtext($1))", [`service:${t[0].id}`]);
  const open = await db.query<{ id: string; kind: string; created_at: string; resolved_at: string | null }>(
    "select id, kind, created_at, resolved_at from service_requests where table_id = $1 and kind = $2 and resolved_at is null and created_at > now() - interval '30 minutes' order by created_at desc limit 1",
    [t[0].id, kind],
  );
  if (open.rows[0]) return { ...open.rows[0], table_label: t[0].label, created: false };
  const recent = await db.query<{ n: number }>("select count(*)::int as n from service_requests where table_id = $1 and created_at > now() - interval '10 minutes'", [t[0].id]);
  if (recent.rows[0].n >= 6) throw conflict("We've got your requests — someone is on the way.");
  const { rows } = await db.query<{ id: string; kind: string; created_at: string; resolved_at: string | null }>(
    "insert into service_requests (table_id, kind) values ($1,$2) returning id, kind, created_at, resolved_at",
    [t[0].id, kind],
  );
  return { ...rows[0], table_label: t[0].label, created: true };
}

/* ── Feedback ─────────────────────────────────────────────────────────── */
export async function leaveFeedback(db: Queryable, orderId: string, rating: number, comment: string | null) {
  const { rows } = await db.query<{ status: string; done_at: string | null }>("select status, coalesce(completed_at, served_at) as done_at from orders where id = $1", [orderId]);
  const o = rows[0];
  if (!o) throw notFound("Order");
  if (!["served", "completed"].includes(o.status)) throw conflict("You can rate the order once it's served.");
  if (o.done_at && Date.now() - new Date(o.done_at).getTime() > 3 * 86400000) throw conflict("Feedback for this order is closed.");
  await db.query(
    `insert into order_feedback (order_id, rating, comment) values ($1,$2,$3)
     on conflict (order_id) do update set rating = excluded.rating, comment = excluded.comment, updated_at = now()`,
    [orderId, rating, comment?.trim() || null],
  );
}

/* ── UPI "I've paid" ───────────────────────────────────────────────────── */
export async function claimUpi(db: Queryable, orderId: string, reference: string | null) {
  const { rows } = await db.query<{ status: string; payment_method: string; payment_status: string; upi_claimed_at: string | null }>(
    "select status, payment_method, payment_status, upi_claimed_at from orders where id = $1 for update",
    [orderId],
  );
  const o = rows[0];
  if (!o) throw notFound("Order");
  if (o.payment_method !== "upi") throw conflict("This order is paid at the counter.");
  if (["cancelled", "rejected"].includes(o.status)) throw conflict("This order was cancelled.");
  if (o.payment_status === "paid") return { already: true };
  await db.query("update orders set upi_claimed_at = coalesce(upi_claimed_at, now()), upi_reference = coalesce($2, upi_reference), updated_at = now() where id = $1", [orderId, reference?.trim() || null]);
  return { already: false };
}

/* ── Close the day ──────────────────────────────────────────────────────── */
export async function dayFigures(day: string, db: Queryable | null = null) {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run<Record<string, number>>(
    `with b as (select ($1::date)::timestamp at time zone 'Asia/Kolkata' as s, ($1::date + 1)::timestamp at time zone 'Asia/Kolkata' as e)
     select
       coalesce(sum(p.amount) filter (where p.method = 'cash' and p.kind = 'payment'), 0) as cash_in,
       coalesce(sum(p.amount) filter (where p.method = 'cash' and p.kind = 'refund'), 0) as cash_refunds,
       coalesce(sum(p.amount) filter (where p.method = 'upi' and p.kind = 'payment'), 0) - coalesce(sum(p.amount) filter (where p.method = 'upi' and p.kind = 'refund'), 0) as upi_received,
       coalesce(sum(p.amount) filter (where p.method = 'card' and p.kind = 'payment'), 0) - coalesce(sum(p.amount) filter (where p.method = 'card' and p.kind = 'refund'), 0) as card_received,
       count(distinct p.order_id) filter (where p.kind = 'payment')::int as paid_orders,
       (select coalesce(sum(x.amount), 0) from expenses x where not x.is_void and x.spent_on = $1::date and x.payment_method = 'cash') as cash_expenses,
       (select count(*)::int from orders o, b where o.status not in ('cancelled','rejected') and o.payment_status in ('unpaid','partial') and o.created_at >= b.s and o.created_at < b.e) as unpaid_orders,
       (select coalesce(sum(o.total - o.amount_paid), 0) from orders o, b where o.status not in ('cancelled','rejected') and o.payment_status in ('unpaid','partial') and o.created_at >= b.s and o.created_at < b.e) as unpaid_total,
       (select count(*)::int from orders o, b where o.status in ('new','accepted','preparing','ready','served') and o.created_at >= b.s and o.created_at < b.e) as open_orders
     from payments p, b where p.created_at >= b.s and p.created_at < b.e`,
    [day],
  );
  const r = rows[0];
  const n = (k: string) => round2(Number(r[k] ?? 0));
  return {
    cash_received: round2(n("cash_in") - n("cash_refunds")),
    cash_refunds: n("cash_refunds"),
    upi_received: n("upi_received"),
    card_received: n("card_received"),
    paid_orders: Number(r.paid_orders ?? 0),
    cash_expenses: n("cash_expenses"),
    unpaid_orders: Number(r.unpaid_orders ?? 0),
    unpaid_total: n("unpaid_total"),
    open_orders: Number(r.open_orders ?? 0),
  };
}

export async function closeDay(db: Queryable, input: { day: string; opening_float: number; paid_out: number; counted: number; note: string }, userId: string) {
  const today = cafeClock().date;
  if (input.day > today) throw bad("You can't close a future day.");
  const f = await dayFigures(input.day, db);
  const expected = round2(input.opening_float + f.cash_received - input.paid_out);
  const difference = round2(input.counted - expected);
  const before = await db.query<{ counted_cash: number; difference: number }>("select counted_cash, difference from day_closings where day = $1 for update", [input.day]);
  const { rows } = await db.query(
    `insert into day_closings (day, opening_float, cash_received, cash_paid_out, expected_cash, counted_cash, difference, upi_received, card_received, note, closed_by, closed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (day) do update set opening_float = excluded.opening_float, cash_received = excluded.cash_received, cash_paid_out = excluded.cash_paid_out,
       expected_cash = excluded.expected_cash, counted_cash = excluded.counted_cash, difference = excluded.difference, upi_received = excluded.upi_received,
       card_received = excluded.card_received, note = excluded.note, closed_by = excluded.closed_by, closed_at = now()
     returning *, day::text as day`,
    [input.day, input.opening_float, f.cash_received, input.paid_out, expected, input.counted, difference, f.upi_received, f.card_received, input.note, userId],
  );
  return { closing: rows[0], reclosed: !!before.rows[0], previous: before.rows[0] ?? null };
}
