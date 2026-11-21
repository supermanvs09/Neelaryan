import "server-only";
import type { Queryable } from "./db";
import { conflict } from "./http";
import { round2 } from "@/lib/pricing";

/**
 * Stock engine.
 *  - Ingredients are consumed through recipes when an order is accepted (confirmed),
 *    never when something is added to a cart, and returned if the order is cancelled.
 *  - Low ingredient stock never blocks a sale (counts drift; the kitchen decides).
 *  - Directly sold products (retail / wholesale) DO block: you can't sell what isn't there.
 *  - Rows are locked in id order so concurrent orders can't oversell or deadlock.
 *  - Average cost is a weighted moving average updated on every purchase.
 */

interface Need {
  item_id: string;
  qty: number;
  strict: boolean; // directly sold product — must be in stock
  /** strict need measured in plain units (ready-made portions), not the product's selling unit */
  perUnit?: boolean;
}

interface OrderLineForStock {
  id: string;
  menu_item_id: string | null;
  inventory_item_id: string | null;
  variant_id: string | null;
  modifiers: { id: string }[];
  qty: number;
}

/** Locks inventory rows (ordered) and returns them by id. */
async function lockItems(db: Queryable, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; name: string; stock_qty: number; avg_cost: number | null; sell_unit_qty: number | null; base_unit: string }>();
  const { rows } = await db.query<{ id: string; name: string; stock_qty: number; avg_cost: number | null; sell_unit_qty: number | null; base_unit: string }>(
    "select id, name, stock_qty, avg_cost, sell_unit_qty, base_unit from inventory_items where id = any($1::uuid[]) order by id for update",
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/** Consume batches first-expiring-first (informational: expiry tracking). */
async function consumeBatches(db: Queryable, itemId: string, qty: number) {
  let left = qty;
  const { rows } = await db.query<{ id: string; qty_remaining: number }>(
    "select id, qty_remaining from inventory_batches where item_id = $1 and qty_remaining > 0 order by expiry_date nulls last, received_at for update",
    [itemId],
  );
  for (const b of rows) {
    if (left <= 0) break;
    const take = Math.min(left, b.qty_remaining);
    await db.query("update inventory_batches set qty_remaining = qty_remaining - $2 where id = $1", [b.id, take]);
    left -= take;
  }
}

/**
 * Deducts stock for an order and snapshots each line's unit cost (for COGS).
 * Idempotent: does nothing if the order already had its stock deducted.
 */
export async function deductForOrder(db: Queryable, orderId: string, userId: string | null) {
  const { rows: ord } = await db.query<{ stock_deducted: boolean; number: number }>("select stock_deducted, number from orders where id = $1 for update", [orderId]);
  if (!ord[0] || ord[0].stock_deducted) return;
  const { rows: lines } = await db.query<OrderLineForStock>(
    "select id, menu_item_id, inventory_item_id, variant_id, modifiers, qty from order_items where order_id = $1",
    [orderId],
  );

  const menuIds = lines.map((l) => l.menu_item_id).filter(Boolean) as string[];
  const modIds = [...new Set(lines.flatMap((l) => (l.modifiers ?? []).map((m) => m.id)))];
  const [recipes, modRecipes, itemCosts, variantCosts, modCosts] = await Promise.all([
    db.query<{ menu_item_id: string; inventory_item_id: string; qty: number }>("select menu_item_id, inventory_item_id, qty from recipe_lines where menu_item_id = any($1::uuid[])", [menuIds]),
    db.query<{ modifier_id: string; inventory_item_id: string; qty: number }>("select modifier_id, inventory_item_id, qty from modifier_recipe_lines where modifier_id = any($1::uuid[])", [modIds]),
    db.query<{ id: string; cost_price: number | null; stock_item_id: string | null }>("select id, cost_price, stock_item_id from menu_items where id = any($1::uuid[])", [menuIds]),
    db.query<{ id: string; cost_price: number | null }>("select id, cost_price from item_variants where id = any($1::uuid[])", [lines.map((l) => l.variant_id).filter(Boolean)]),
    db.query<{ id: string; cost_price: number | null }>("select id, cost_price from modifiers where id = any($1::uuid[])", [modIds]),
  ]);

  // what each line consumes, per one unit sold
  const perLine = new Map<string, Need[]>();
  for (const l of lines) {
    const needs: Need[] = [];
    if (l.inventory_item_id) needs.push({ item_id: l.inventory_item_id, qty: 1, strict: true }); // scaled by sell_unit_qty below
    // ready-made menu item: one unit of its stock item per portion (can't be oversold)
    const readyMade = itemCosts.rows.find((r) => r.id === l.menu_item_id)?.stock_item_id;
    if (readyMade) needs.push({ item_id: readyMade, qty: 1, strict: true, perUnit: true });
    for (const r of recipes.rows.filter((r) => r.menu_item_id === l.menu_item_id)) needs.push({ item_id: r.inventory_item_id, qty: r.qty, strict: false });
    for (const m of l.modifiers ?? []) for (const r of modRecipes.rows.filter((r) => r.modifier_id === m.id)) needs.push({ item_id: r.inventory_item_id, qty: r.qty, strict: false });
    perLine.set(l.id, needs);
  }

  const items = await lockItems(db, [...new Set([...perLine.values()].flat().map((n) => n.item_id))]);

  // aggregate totals per inventory item
  const totals = new Map<string, { qty: number; strict: boolean }>();
  for (const l of lines) {
    for (const n of perLine.get(l.id)!) {
      const inv = items.get(n.item_id);
      if (!inv) continue;
      const each = n.strict && !n.perUnit ? Number(inv.sell_unit_qty ?? 1) : n.qty;
      const t = totals.get(n.item_id) ?? { qty: 0, strict: false };
      t.qty += each * l.qty;
      t.strict ||= n.strict;
      totals.set(n.item_id, t);
    }
  }

  for (const [itemId, t] of totals) {
    const inv = items.get(itemId)!;
    if (t.strict && Number(inv.stock_qty) < t.qty - 1e-9) throw conflict(`Not enough ${inv.name} in stock for this order.`);
  }

  for (const [itemId, t] of totals) {
    const inv = items.get(itemId)!;
    const qty = Math.round(t.qty * 1000) / 1000;
    await db.query("update inventory_items set stock_qty = stock_qty - $2, updated_at = now() where id = $1", [itemId, qty]);
    await consumeBatches(db, itemId, qty);
    const cost = inv.avg_cost === null ? null : Number(inv.avg_cost);
    await db.query(
      "insert into stock_movements (item_id, kind, qty, unit_cost, value, order_id, reason, user_id) values ($1,'sale',$2,$3,$4,$5,$6,$7)",
      [itemId, -qty, cost, cost === null ? null : round2(-qty * cost), orderId, `Order #${ord[0].number}`, userId],
    );
  }

  // unit cost per line: recipe cost (if any) else the manual item/variant cost, plus modifier costs
  for (const l of lines) {
    let cost: number | null = null;
    const needs = perLine.get(l.id)!;
    if (needs.length) {
      let sum = 0;
      let complete = true;
      for (const n of needs) {
        const inv = items.get(n.item_id);
        if (!inv || inv.avg_cost === null) {
          complete = false;
          continue;
        }
        const each = n.strict && !n.perUnit ? Number(inv.sell_unit_qty ?? 1) : n.qty;
        sum += each * Number(inv.avg_cost);
      }
      cost = complete ? sum : null;
    }
    const recipeCovered = recipes.rows.some((r) => r.menu_item_id === l.menu_item_id) || !!itemCosts.rows.find((r) => r.id === l.menu_item_id)?.stock_item_id;
    if (!recipeCovered && l.menu_item_id) {
      const manual = variantCosts.rows.find((v) => v.id === l.variant_id)?.cost_price ?? itemCosts.rows.find((i) => i.id === l.menu_item_id)?.cost_price ?? null;
      if (manual !== null) {
        const modExtra = (l.modifiers ?? []).reduce((s, m) => s + Number(modCosts.rows.find((x) => x.id === m.id)?.cost_price ?? 0), 0);
        cost = Number(manual) + modExtra + (cost ?? 0);
      }
    }
    await db.query("update order_items set unit_cost = $2 where id = $1", [l.id, cost === null ? null : Math.round(cost * 10000) / 10000]);
  }

  await db.query("update orders set stock_deducted = true where id = $1", [orderId]);
}

/** Puts back everything an order consumed (cancelled / rejected after acceptance). */
export async function returnForOrder(db: Queryable, orderId: string, userId: string | null) {
  const { rows: ord } = await db.query<{ stock_deducted: boolean; number: number }>("select stock_deducted, number from orders where id = $1 for update", [orderId]);
  if (!ord[0]?.stock_deducted) return;
  const { rows } = await db.query<{ item_id: string; qty: number; unit_cost: number | null }>(
    "select item_id, sum(qty) as qty, max(unit_cost) as unit_cost from stock_movements where order_id = $1 and kind in ('sale','sale_return') group by item_id",
    [orderId],
  );
  const items = await lockItems(db, rows.map((r) => r.item_id));
  for (const r of rows) {
    const back = -Number(r.qty);
    if (back <= 0 || !items.has(r.item_id)) continue;
    await db.query("update inventory_items set stock_qty = stock_qty + $2, updated_at = now() where id = $1", [r.item_id, back]);
    // credit the latest-expiring batch, if batches are kept
    await db.query(
      "update inventory_batches set qty_remaining = qty_remaining + $2 where id = (select id from inventory_batches where item_id = $1 order by expiry_date desc nulls first, received_at desc limit 1)",
      [r.item_id, back],
    );
    await db.query(
      "insert into stock_movements (item_id, kind, qty, unit_cost, value, order_id, reason, user_id) values ($1,'sale_return',$2,$3,$4,$5,$6,$7)",
      [r.item_id, back, r.unit_cost, r.unit_cost === null ? null : round2(back * Number(r.unit_cost)), orderId, `Order #${ord[0].number} cancelled`, userId],
    );
  }
  await db.query("update orders set stock_deducted = false where id = $1", [orderId]);
}

export type AdjustKind = "wastage" | "adjustment" | "count" | "opening";

/**
 * Manual stock changes.
 *  - wastage: qty removed (positive number in), valued at average cost
 *  - adjustment: signed correction
 *  - count: physical count → sets stock to the counted value, records the difference
 *  - opening: opening stock with an optional unit cost (sets the average cost if none)
 */
export async function adjustStock(
  db: Queryable,
  input: { item_id: string; kind: AdjustKind; qty: number; unit_cost?: number | null; reason?: string; note?: string; expiry_date?: string | null },
  userId: string | null,
) {
  const items = await lockItems(db, [input.item_id]);
  const inv = items.get(input.item_id);
  if (!inv) throw conflict("That inventory item no longer exists.");
  let delta: number;
  if (input.kind === "wastage") delta = -Math.abs(input.qty);
  else if (input.kind === "count") delta = input.qty - Number(inv.stock_qty);
  else if (input.kind === "opening") delta = Math.abs(input.qty);
  else delta = input.qty;
  delta = Math.round(delta * 1000) / 1000;
  if (delta === 0 && input.kind !== "count") return { delta: 0 };

  let cost = inv.avg_cost === null ? null : Number(inv.avg_cost);
  if (input.kind === "opening" && input.unit_cost != null) {
    // blend the opening stock's cost into the average
    const current = Math.max(0, Number(inv.stock_qty));
    cost = cost === null || current <= 0 ? input.unit_cost : (current * cost + delta * input.unit_cost) / (current + delta);
    await db.query("update inventory_items set avg_cost = $2 where id = $1", [inv.id, cost]);
  }
  await db.query("update inventory_items set stock_qty = stock_qty + $2, updated_at = now() where id = $1", [inv.id, delta]);
  if (delta < 0) await consumeBatches(db, inv.id, -delta);
  else if (delta > 0 && (input.kind === "opening" || input.expiry_date))
    await db.query("insert into inventory_batches (item_id, qty_received, qty_remaining, unit_cost, expiry_date) values ($1,$2,$2,$3,$4)", [inv.id, delta, cost, input.expiry_date ?? null]);
  await db.query(
    "insert into stock_movements (item_id, kind, qty, unit_cost, value, reason, note, user_id) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [inv.id, input.kind, delta, cost, cost === null ? null : round2(delta * cost), input.reason ?? "", input.note ?? "", userId],
  );
  return { delta };
}

/** Receives a purchase: stock up, weighted average cost, expiry batches, movements. */
export async function receivePurchase(db: Queryable, purchaseId: string, userId: string | null) {
  const { rows: lines } = await db.query<{ id: string; item_id: string; qty: number; unit_cost: number; expiry_date: string | null }>(
    "select id, item_id, qty, unit_cost, expiry_date from purchase_lines where purchase_id = $1",
    [purchaseId],
  );
  const { rows: p } = await db.query<{ number: number }>("select number from purchases where id = $1", [purchaseId]);
  const items = await lockItems(db, [...new Set(lines.map((l) => l.item_id))]);
  for (const l of lines) {
    const inv = items.get(l.item_id);
    if (!inv) continue;
    const current = Math.max(0, Number(inv.stock_qty));
    const old = inv.avg_cost === null ? null : Number(inv.avg_cost);
    const qty = Number(l.qty);
    const avg = old === null || current <= 0 ? Number(l.unit_cost) : (current * old + qty * Number(l.unit_cost)) / (current + qty);
    await db.query("update inventory_items set stock_qty = stock_qty + $2, avg_cost = $3, updated_at = now() where id = $1", [inv.id, qty, avg]);
    inv.stock_qty = Number(inv.stock_qty) + qty;
    inv.avg_cost = avg;
    await db.query(
      "insert into inventory_batches (item_id, purchase_line_id, qty_received, qty_remaining, unit_cost, expiry_date) values ($1,$2,$3,$3,$4,$5)",
      [inv.id, l.id, qty, l.unit_cost, l.expiry_date],
    );
    await db.query(
      "insert into stock_movements (item_id, kind, qty, unit_cost, value, purchase_id, reason, user_id) values ($1,'purchase',$2,$3,$4,$5,$6,$7)",
      [inv.id, qty, l.unit_cost, round2(qty * Number(l.unit_cost)), purchaseId, `Purchase #${p[0]?.number ?? ""}`, userId],
    );
  }
}

/** Reverses a received purchase (e.g. entered by mistake). Refused if the stock was already used. */
export async function cancelPurchase(db: Queryable, purchaseId: string, userId: string | null) {
  const { rows: lines } = await db.query<{ id: string; item_id: string; qty: number; unit_cost: number }>(
    "select id, item_id, qty, unit_cost from purchase_lines where purchase_id = $1",
    [purchaseId],
  );
  const items = await lockItems(db, [...new Set(lines.map((l) => l.item_id))]);
  for (const l of lines) {
    const inv = items.get(l.item_id);
    if (!inv) continue;
    if (Number(inv.stock_qty) < Number(l.qty) - 1e-9) throw conflict(`Can't cancel: some ${inv.name} from this purchase has already been used.`);
  }
  for (const l of lines) {
    const inv = items.get(l.item_id)!;
    const qty = Number(l.qty);
    const remaining = Number(inv.stock_qty) - qty;
    // unwind this purchase from the weighted average
    const old = inv.avg_cost === null ? null : Number(inv.avg_cost);
    const avg = old === null || remaining <= 0 ? old : Math.max(0, (Number(inv.stock_qty) * old - qty * Number(l.unit_cost)) / remaining);
    await db.query("update inventory_items set stock_qty = stock_qty - $2, avg_cost = $3, updated_at = now() where id = $1", [inv.id, qty, avg]);
    inv.stock_qty = remaining;
    inv.avg_cost = avg;
    await db.query("delete from inventory_batches where purchase_line_id = $1", [l.id]);
    await db.query(
      "insert into stock_movements (item_id, kind, qty, unit_cost, value, purchase_id, reason, user_id) values ($1,'purchase_cancel',$2,$3,$4,$5,'Purchase cancelled',$6)",
      [inv.id, -qty, l.unit_cost, round2(-qty * Number(l.unit_cost)), purchaseId, userId],
    );
  }
}
