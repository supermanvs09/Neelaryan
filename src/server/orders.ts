import "server-only";
import { q, type Queryable } from "./db";
import { ApiError, bad, conflict, notFound } from "./http";
import { getSetting } from "./settings";
import { loadMenu } from "./menu";
import { billTotals, priceLine, round2, type LineInput } from "@/lib/pricing";
import { deductForOrder, returnForOrder } from "./inventory";
import { earnForOrder, evaluateRedemption, markRedemptionUsed, maxPointsDiscount, restoreForOrder, reverseEarnForOrder, spendPoints } from "./loyalty";
import type { Permission } from "./auth/permissions";

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled" | "rejected";
export type OrderType = "dine_in" | "takeaway";

export const OPEN_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready", "served"];

/** The state machine. Kitchen staff may only move food forward. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served", "completed", "cancelled"],
  served: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};
const KITCHEN_MOVES: Partial<Record<OrderStatus, OrderStatus[]>> = { new: ["accepted"], accepted: ["preparing"], preparing: ["ready"] };

export function allowedNext(status: OrderStatus, type: OrderType) {
  return TRANSITIONS[status].filter((s) => !(s === "served" && type !== "dine_in") && !(s === "completed" && status === "ready" && type === "dine_in"));
}

const STAMP: Partial<Record<OrderStatus, string>> = {
  accepted: "accepted_at",
  preparing: "preparing_at",
  ready: "ready_at",
  served: "served_at",
  completed: "completed_at",
  cancelled: "cancelled_at",
  rejected: "cancelled_at",
};

export interface ProductLineInput {
  product_id: string;
  qty: number;
}

export interface BuildInput {
  lines: (LineInput & { notes?: string })[];
  products?: ProductLineInput[];
  tier: "retail" | "wholesale";
  customerId: string | null;
  usePoints?: number;
  rewardCode?: string | null;
  manualDiscount?: number;
}

/** Prices every line from the database and computes the bill. Throws on anything invalid. */
export async function buildOrder(db: Queryable, input: BuildInput) {
  if (!input.lines.length && !input.products?.length) throw bad("Add at least one item.");
  if (input.lines.length + (input.products?.length ?? 0) > 60) throw bad("That's too many lines for one order.");
  const menu = await loadMenu("public", db);
  const items: {
    menu_item_id: string | null;
    inventory_item_id: string | null;
    variant_id: string | null;
    name: string;
    variant_name: string;
    modifiers: { id: string; name: string; group: string; price: number }[];
    removed: string[];
    qty: number;
    unit_price: number;
    line_total: number;
    notes: string;
    discount: number;
    offer_id: string | null;
    offer_title: string | null;
  }[] = [];

  for (const l of input.lines) {
    const p = priceLine(menu, l);
    if (!p.ok) throw bad(p.error);
    items.push({
      menu_item_id: p.item.id,
      inventory_item_id: null,
      variant_id: p.variant?.id ?? null,
      name: p.name,
      variant_name: p.variant?.name ?? "",
      modifiers: p.modifiers,
      removed: p.removed,
      qty: l.qty,
      unit_price: p.unitPrice,
      line_total: p.lineTotal,
      notes: (l.notes ?? "").trim().slice(0, 140),
      discount: p.discount,
      offer_id: p.offer?.id ?? null,
      offer_title: p.offer?.title ?? null,
    });
  }

  // ready-made items: never accept more portions than are left
  const readyMade = new Map<string, number>();
  for (const it of items) {
    const m = menu.items.find((x) => x.id === it.menu_item_id);
    if (m?.stock_item_id) readyMade.set(m.id, (readyMade.get(m.id) ?? 0) + it.qty);
  }
  for (const [id, qty] of readyMade) {
    const m = menu.items.find((x) => x.id === id)!;
    const left = m.stock_left ?? 0;
    if (qty > left) throw bad(left > 0 ? `Only ${left} ${m.name} left right now.` : `${m.name} just sold out.`);
  }

  if (input.products?.length) {
    const { rows } = await db.query<{ id: string; name: string; sell_unit_name: string; retail_price: number | null; wholesale_price: number | null; is_sellable: boolean; is_active: boolean }>(
      "select id, name, sell_unit_name, retail_price, wholesale_price, is_sellable, is_active from inventory_items where id = any($1::uuid[])",
      [input.products.map((p) => p.product_id)],
    );
    for (const pl of input.products) {
      const p = rows.find((r) => r.id === pl.product_id);
      if (!p || !p.is_sellable || !p.is_active) throw bad("A product in this sale isn't available for sale.");
      const price = input.tier === "wholesale" ? p.wholesale_price ?? p.retail_price : p.retail_price;
      if (price === null) throw bad(`${p.name} has no ${input.tier} price set.`);
      if (!Number.isInteger(pl.qty) || pl.qty < 1 || pl.qty > 999) throw bad("Quantity must be a whole number between 1 and 999.");
      items.push({
        menu_item_id: null,
        inventory_item_id: p.id,
        variant_id: null,
        name: p.name,
        variant_name: p.sell_unit_name,
        modifiers: [],
        removed: [],
        qty: pl.qty,
        unit_price: Number(price),
        line_total: round2(Number(price) * pl.qty),
        notes: "",
        discount: 0,
        offer_id: null,
        offer_title: null,
      });
    }
  }

  const subtotal = round2(items.reduce((s, i) => s + i.line_total, 0));
  let discount = 0;
  let redemption: Awaited<ReturnType<typeof evaluateRedemption>> | null = null;
  if (input.rewardCode) {
    redemption = await evaluateRedemption(db, input.rewardCode, input.customerId, items, subtotal);
    discount += redemption.discount;
  }
  let pointsUsed = 0;
  if (input.usePoints && input.usePoints > 0) {
    if (!input.customerId) throw bad("Sign in to use your points.");
    const loyalty = await getSetting("loyalty", db);
    const { rows } = await db.query<{ points_balance: number }>("select points_balance from customers where id = $1", [input.customerId]);
    const cap = maxPointsDiscount(subtotal - discount, rows[0]?.points_balance ?? 0, loyalty);
    if (input.usePoints < loyalty.min_redeem_points) throw bad(`Use at least ${loyalty.min_redeem_points} points at a time.`);
    if (input.usePoints > cap.points) throw bad(`You can use up to ${cap.points} points on this order.`);
    pointsUsed = Math.floor(input.usePoints);
    discount += round2(pointsUsed * loyalty.point_value);
  }
  if (input.manualDiscount && input.manualDiscount > 0) discount += input.manualDiscount;
  const tax = await getSetting("tax", db);
  const totals = billTotals(subtotal, discount, tax);
  return { items, totals, redemption, pointsUsed };
}

export interface CreateOrderInput extends BuildInput {
  type: OrderType;
  channel: "qr" | "web" | "pos";
  tableId: string | null;
  customerName: string;
  customerPhone: string;
  notes: string;
  idempotencyKey: string;
  accessHash: string | null;
  createdBy: string | null;
  /** POS orders are confirmed by staff immediately. */
  autoAccept: boolean;
  /** how the guest will pay (POS orders: "counter") */
  paymentMethod?: "cash" | "upi" | "counter";
  /** pre-order pickup time (takeaway, later today) */
  scheduledFor?: string | null;
}

export async function createOrder(db: Queryable, input: CreateOrderInput) {
  const existing = await db.query<{ id: string; number: number; total: number }>("select id, number, total from orders where idempotency_key = $1", [input.idempotencyKey]);
  if (existing.rows[0]) return { ...existing.rows[0], replayed: true };

  const built = await buildOrder(db, input);
  const { rows } = await db.query<{ id: string; number: number; total: number }>(
    `insert into orders (type, channel, price_tier, table_id, customer_id, customer_name, customer_phone, subtotal, discount, service_charge, tax, total,
                         points_used, redemption_id, notes, idempotency_key, access_hash, created_by, payment_method, scheduled_for)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     returning id, number, total`,
    [
      input.type,
      input.channel,
      input.tier,
      input.tableId,
      input.customerId,
      input.customerName,
      input.customerPhone,
      built.totals.subtotal,
      built.totals.discount,
      built.totals.service_charge,
      built.totals.tax,
      built.totals.total,
      built.pointsUsed,
      built.redemption?.id ?? null,
      input.notes,
      input.idempotencyKey,
      input.accessHash,
      input.createdBy,
      input.paymentMethod ?? (input.channel === "pos" ? "counter" : "cash"),
      input.scheduledFor ?? null,
    ],
  );
  const order = rows[0];
  for (const i of built.items) {
    const mods = [...i.modifiers, ...i.removed.map((r) => ({ id: "", name: `No ${r}`, group: "removed", price: 0 }))];
    await db.query(
      `insert into order_items (order_id, menu_item_id, inventory_item_id, variant_id, name, variant_name, modifiers, qty, unit_price, line_total, notes, discount, offer_id, offer_title)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [order.id, i.menu_item_id, i.inventory_item_id, i.variant_id, i.name, i.variant_name, JSON.stringify(mods.filter((m) => m.id || m.group === "removed")), i.qty, i.unit_price, i.line_total, i.notes, i.discount, i.offer_id, i.offer_title],
    );
  }
  await db.query("insert into order_events (order_id, status, user_id) values ($1,'new',$2)", [order.id, input.createdBy]);
  if (built.pointsUsed && input.customerId) {
    await spendPoints(db, input.customerId, built.pointsUsed, { kind: "redeem", order_id: order.id, note: `Used on order #${order.number}` });
  }
  if (built.redemption) await markRedemptionUsed(db, built.redemption.id, order.id);
  if (input.autoAccept) await transition(db, order.id, "accepted", { userId: input.createdBy, permissions: ["orders.manage"] });
  return { ...order, replayed: false };
}

interface Actor {
  userId: string | null;
  permissions: Permission[] | "customer";
  reason?: string;
}

/** Moves an order through the state machine and applies the side effects. */
export async function transition(db: Queryable, orderId: string, to: OrderStatus, actor: Actor) {
  const { rows } = await db.query<{ id: string; status: OrderStatus; type: OrderType; payment_status: string; number: number }>(
    "select id, status, type, payment_status, number from orders where id = $1 for update",
    [orderId],
  );
  const o = rows[0];
  if (!o) throw notFound("Order");
  if (o.status === to) return o;
  if (!allowedNext(o.status, o.type).includes(to)) throw conflict(`An order that is ${label(o.status)} can't be marked ${label(to)}.`);

  if (actor.permissions === "customer") {
    if (!(o.status === "new" && to === "cancelled" && o.payment_status === "unpaid")) throw conflict("This order can no longer be cancelled here — please ask our team.");
  } else {
    const manage = actor.permissions.includes("orders.manage");
    const kitchen = actor.permissions.includes("kitchen.update") && (KITCHEN_MOVES[o.status] ?? []).includes(to);
    if (!manage && !kitchen) throw new ApiError(403, "You don't have permission to do that.", "FORBIDDEN");
  }
  if (to === "completed" && o.payment_status !== "paid") throw conflict("Record the payment before completing this order.");
  if ((to === "cancelled" || to === "rejected") && !actor.reason?.trim()) throw bad("Give a reason for cancelling.");

  if (to === "accepted") await deductForOrder(db, o.id, actor.userId);
  if (to === "cancelled" || to === "rejected") {
    await returnForOrder(db, o.id, actor.userId);
    await restoreForOrder(db, o.id);
  }

  const stamp = STAMP[to];
  await db.query(
    `update orders set status = $2, updated_at = now() ${stamp ? `, ${stamp} = coalesce(${stamp}, now())` : ""}
       ${to === "cancelled" || to === "rejected" ? ", cancel_reason = $3" : ""} where id = $1`,
    to === "cancelled" || to === "rejected" ? [o.id, to, actor.reason!.trim().slice(0, 200)] : [o.id, to],
  );
  await db.query("insert into order_events (order_id, status, user_id, note) values ($1,$2,$3,$4)", [o.id, to, actor.userId, actor.reason ?? ""]);

  if (to === "completed") await onCompleted(db, o.id);
  return { ...o, status: to };
}

async function onCompleted(db: Queryable, orderId: string) {
  const { rows } = await db.query<{ customer_id: string | null; total: number }>("select customer_id, total from orders where id = $1", [orderId]);
  const o = rows[0];
  if (o?.customer_id) {
    await db.query("update customers set visits = visits + 1, total_spent = total_spent + $2, last_order_at = now(), updated_at = now() where id = $1", [o.customer_id, o.total]);
    await earnForOrder(db, orderId);
  }
}

export const label = (s: OrderStatus) =>
  ({ new: "new", accepted: "accepted", preparing: "preparing", ready: "ready", served: "served", completed: "completed", cancelled: "cancelled", rejected: "rejected" })[s];

async function refreshPaymentStatus(db: Queryable, orderId: string) {
  const { rows } = await db.query<{ total: number; paid: number; refunded: number }>(
    `select o.total,
            coalesce(sum(p.amount) filter (where p.kind = 'payment'), 0) as paid,
            coalesce(sum(p.amount) filter (where p.kind = 'refund'), 0) as refunded
       from orders o left join payments p on p.order_id = o.id where o.id = $1 group by o.id`,
    [orderId],
  );
  const r = rows[0];
  const net = round2(Number(r.paid) - Number(r.refunded));
  const status = Number(r.refunded) > 0 && net <= 0 ? "refunded" : net >= Number(r.total) - 0.005 ? "paid" : net > 0 ? "partial" : "unpaid";
  await db.query("update orders set amount_paid = $2, payment_status = $3, updated_at = now() where id = $1", [orderId, net, status]);
  return { status, net, total: Number(r.total) };
}

/** Records a payment. Refuses overpayment so totals always reconcile. */
export async function recordPayment(db: Queryable, orderId: string, p: { method: string; amount: number; reference: string }, userId: string) {
  const { rows } = await db.query<{ status: OrderStatus; total: number; amount_paid: number }>("select status, total, amount_paid from orders where id = $1 for update", [orderId]);
  const o = rows[0];
  if (!o) throw notFound("Order");
  if (o.status === "cancelled" || o.status === "rejected") throw conflict("This order was cancelled.");
  const due = round2(Number(o.total) - Number(o.amount_paid));
  if (due <= 0) throw conflict("This order is already fully paid.");
  if (p.amount - due > 0.005) throw bad(`Only ₹${due} is due on this order.`);
  await db.query("insert into payments (order_id, kind, method, amount, reference, created_by) values ($1,'payment',$2,$3,$4,$5)", [orderId, p.method, round2(p.amount), p.reference, userId]);
  return refreshPaymentStatus(db, orderId);
}

export async function recordRefund(db: Queryable, orderId: string, p: { method: string; amount: number; reference: string }, userId: string) {
  const { rows } = await db.query<{ status: OrderStatus; amount_paid: number }>("select status, amount_paid from orders where id = $1 for update", [orderId]);
  const o = rows[0];
  if (!o) throw notFound("Order");
  if (p.amount - Number(o.amount_paid) > 0.005) throw bad(`At most ₹${o.amount_paid} can be refunded.`);
  await db.query("insert into payments (order_id, kind, method, amount, reference, created_by) values ($1,'refund',$2,$3,$4,$5)", [orderId, p.method, round2(p.amount), p.reference, userId]);
  const r = await refreshPaymentStatus(db, orderId);
  // a completed order that's been fully refunded gives back the points it earned
  if (o.status === "completed" && r.status === "refunded") await reverseEarnForOrder(db, orderId, userId);
  return r;
}

/** Full order with lines, payments and history (staff view). */
export async function orderDetail(orderId: string, db: Queryable | null = null) {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run<Record<string, unknown>>(
    `select o.*, t.label as table_label, c.name as customer_account_name, c.points_balance as customer_points, u.name as created_by_name
       from orders o left join dining_tables t on t.id = o.table_id left join customers c on c.id = o.customer_id left join users u on u.id = o.created_by
      where o.id = $1`,
    [orderId],
  );
  if (!rows[0]) return null;
  const [items, payments, events] = await Promise.all([
    run("select id, menu_item_id, inventory_item_id, name, variant_name, modifiers, qty, unit_price, line_total, unit_cost, notes from order_items where order_id = $1 order by id", [orderId]),
    run("select p.id, p.kind, p.method, p.amount, p.reference, p.created_at, u.name as by from payments p left join users u on u.id = p.created_by where order_id = $1 order by created_at", [orderId]),
    run("select e.status, e.note, e.at, u.name as by from order_events e left join users u on u.id = e.user_id where order_id = $1 order by e.at, e.id", [orderId]),
  ]);
  const o = rows[0];
  delete o.access_hash;
  delete o.idempotency_key;
  return { ...o, items: items.rows, payments: payments.rows, events: events.rows, next: allowedNext(o.status as OrderStatus, o.type as OrderType) };
}

/** Customer-facing order (no costs, no staff names). */
export async function publicOrder(orderId: string) {
  const { rows } = await q<Record<string, unknown>>(
    `select o.id, o.number, o.type, o.status, o.payment_status, o.subtotal, o.discount, o.service_charge, o.tax, o.total, o.amount_paid, o.points_used,
            o.customer_name, o.created_at, o.accepted_at, o.preparing_at, o.ready_at, o.served_at, o.completed_at, o.cancelled_at, o.cancel_reason,
            o.customer_id, t.label as table_label, t.qr_token as table_token, o.payment_method, o.upi_claimed_at, o.scheduled_for,
            (select json_build_object('rating', f.rating, 'comment', f.comment) from order_feedback f where f.order_id = o.id) as feedback,
            (select coalesce(pt.points, 0) from point_transactions pt where pt.order_id = o.id and pt.kind = 'earn') as points_earned
       from orders o left join dining_tables t on t.id = o.table_id where o.id = $1`,
    [orderId],
  );
  if (!rows[0]) return null;
  const items = await q("select menu_item_id, variant_id, name, variant_name, modifiers, qty, unit_price, line_total, notes, discount, offer_title from order_items where order_id = $1 order by id", [orderId]);
  // the table's QR token is only needed for "call staff"; never expose it once the order is over
  const o = rows[0] as Record<string, unknown>;
  const open = ["new", "accepted", "preparing", "ready", "served"].includes(String(o.status));
  return { ...o, table_token: open ? o.table_token : null, linked: Boolean(o.customer_id), customer_id: undefined, items: items.rows };
}
