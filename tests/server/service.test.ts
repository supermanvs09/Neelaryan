import { beforeAll, describe, expect, it } from "vitest";
import { freshDb, key } from "./helpers";
import type { Db } from "@/server/db";
import type { Ctx } from "@/server/http";

let db: Db;
const staff = { userId: null, permissions: ["orders.manage", "kitchen.update", "billing.manage"] as never };
const ctx = { user: null, ip: "test" } as unknown as Ctx;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

beforeAll(async () => {
  db = await freshDb();
});

async function item(slug: string) {
  return (await db.query<{ id: string; price: number }>("select id, price from menu_items where slug = $1", [slug])).rows[0];
}
async function order(lines: { item_id: string; modifier_ids?: string[]; qty: number }[], extra: Record<string, unknown> = {}) {
  const { createOrder } = await import("@/server/orders");
  return db.tx((t) =>
    createOrder(t, { lines, tier: "retail", customerId: null, type: "takeaway", channel: "web", tableId: null, customerName: "Asha", customerPhone: "9876543210", notes: "", idempotencyKey: key(), accessHash: null, createdBy: null, autoAccept: false, ...extra }),
  );
}

describe("offers", () => {
  it("are live only on their days, hours and dates", async () => {
    const { isOfferLive } = await import("@/lib/offers");
    const o = { id: "x", title: "Evening", percent_off: 20, menu_item_ids: [], days: [1, 2, 3, 4, 5], starts_at: "16:00", ends_at: "19:00", valid_from: "2026-11-01", valid_to: "2026-11-30", is_active: true };
    expect(isOfferLive(o, { date: "2026-11-20", dow: 5, minutes: 17 * 60 })).toBe(true);
    expect(isOfferLive(o, { date: "2026-11-21", dow: 6, minutes: 17 * 60 })).toBe(false); // Saturday
    expect(isOfferLive(o, { date: "2026-11-20", dow: 5, minutes: 19 * 60 })).toBe(false); // ends at 7 pm
    expect(isOfferLive(o, { date: "2026-12-01", dow: 2, minutes: 17 * 60 })).toBe(false); // after the dates
    expect(isOfferLive({ ...o, is_active: false }, { date: "2026-11-20", dow: 5, minutes: 17 * 60 })).toBe(false);
  });

  it("take the best live offer off the base price only, and the server records it", async () => {
    const capp = await item("cappuccino");
    // whole-menu 10% all day, and 25% on cappuccino all day → 25% wins
    await db.query("insert into offers (title, percent_off) values ('Everything 10', 10)");
    await db.query("insert into offers (title, percent_off, menu_item_ids) values ('Coffee hour', 25, $1)", [[capp.id]]);
    const o = await order([{ item_id: capp.id, qty: 2 }]);
    const line = (await db.query<{ unit_price: number; discount: number; offer_title: string }>("select unit_price, discount, offer_title from order_items where order_id = $1", [o.id])).rows[0];
    const off = Math.floor((capp.price * 25) / 100);
    expect(line).toEqual({ unit_price: capp.price - off, discount: off, offer_title: "Coffee hour" });
    // add-ons are never discounted
    const oats = await item("banana-peanut-butter-oats");
    const straw = (await db.query<{ id: string }>(
      "select m.id from modifiers m join item_modifier_groups g on g.group_id = m.group_id where g.item_id = $1 and m.visual_key = 'strawberry'",
      [oats.id],
    )).rows[0].id;
    const def = (await db.query<{ modifier_id: string }>("select modifier_id from item_default_modifiers where item_id = $1", [oats.id])).rows.map((r) => r.modifier_id);
    const o2 = await order([{ item_id: oats.id, modifier_ids: [...def, straw], qty: 1 }]);
    const l2 = (await db.query<{ unit_price: number; discount: number }>("select unit_price, discount from order_items where order_id = $1", [o2.id])).rows[0];
    expect(l2.discount).toBe(Math.floor((oats.price * 10) / 100));
    expect(l2.unit_price).toBe(oats.price - l2.discount + 15); // strawberry +₹15 at full price
    await db.query("delete from offers");
  });
});

describe("ready-made items", () => {
  it("sell from stock, refuse more than is left and show sold out at zero", async () => {
    const { saveInventoryItem, InvItemSchema } = await import("@/server/inventory-admin");
    const { adjustStock } = await import("@/server/inventory");
    const { loadMenu } = await import("@/server/menu");
    const { transition } = await import("@/server/orders");
    const samosa = await db.tx((t) => saveInventoryItem(t, ctx, null, InvItemSchema.parse({ name: "Samosa (made)", display_unit: "pcs" })));
    await db.tx((t) => adjustStock(t, { item_id: samosa, kind: "opening", qty: 3, unit_cost: 8 }, null));
    const m = await item("veg-sandwich").catch(() => null);
    const menuItem = m ?? (await db.query<{ id: string; price: number }>("select id, price from menu_items where status = 'available' and visual = 'art' order by sort limit 1")).rows[0];
    await db.query("update menu_items set stock_item_id = $2 where id = $1", [menuItem.id, samosa]);

    await expect(order([{ item_id: menuItem.id, qty: 4 }])).rejects.toThrow(/Only 3 .* left/);
    const o = await order([{ item_id: menuItem.id, qty: 3 }]);
    await db.tx((t) => transition(t, o.id, "accepted", staff));
    const left = (await db.query<{ stock_qty: number }>("select stock_qty from inventory_items where id = $1", [samosa])).rows[0];
    expect(Number(left.stock_qty)).toBe(0);
    const pub = await loadMenu("public");
    expect(pub.items.find((i) => i.id === menuItem.id)!.status).toBe("sold_out");
    const cost = (await db.query<{ unit_cost: number }>("select unit_cost from order_items where order_id = $1", [o.id])).rows[0];
    expect(Number(cost.unit_cost)).toBe(8); // stock cost, not added to a manual cost price
    await db.query("update menu_items set stock_item_id = null where id = $1", [menuItem.id]);
  });
});

describe("pre-orders, wait time, requests, feedback, UPI", () => {
  it("accept pickup times 15 min – 12 h ahead on 15-minute slots, today only", async () => {
    const { validatePickup } = await import("@/server/service");
    const now = new Date("2026-11-21T09:00:00+05:30");
    expect(validatePickup("2026-11-21T09:30:00+05:30", now)).toBe(new Date("2026-11-21T09:30:00+05:30").toISOString());
    expect(() => validatePickup("2026-11-21T09:10:00+05:30", now)).toThrow(/at least 15 minutes/);
    expect(() => validatePickup("2026-11-21T09:40:00+05:30", now)).toThrow(/pickup times shown/);
    expect(() => validatePickup("2026-11-22T09:30:00+05:30", now)).toThrow(/later today/);
  });

  it("estimates the wait from recent kitchen times and the queue", async () => {
    const { kitchenEta } = await import("@/server/service");
    const r = await kitchenEta(db);
    expect(r.minutes).toBeGreaterThanOrEqual(5);
    expect(r.minutes).toBeLessThanOrEqual(60);
  });

  it("dedupes repeated table requests", async () => {
    const { requestService } = await import("@/server/service");
    const token = (await db.query<{ qr_token: string }>("select qr_token from dining_tables order by sort limit 1")).rows[0].qr_token;
    const a = await db.tx((t) => requestService(t, token, "water"));
    const b = await db.tx((t) => requestService(t, token, "water"));
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
    await expect(db.tx((t) => requestService(t, "not-a-real-token", "water"))).rejects.toThrow();
  });

  it("only takes feedback after the order is served, and a UPI claim only for UPI orders", async () => {
    const { leaveFeedback, claimUpi } = await import("@/server/service");
    const { transition } = await import("@/server/orders");
    const tea = await item("classic-tea");
    const o = await order([{ item_id: tea.id, qty: 1 }], { paymentMethod: "upi" });
    await expect(db.tx((t) => leaveFeedback(t, o.id, 5, "Great"))).rejects.toThrow(/once it's served/);
    await db.tx((t) => claimUpi(t, o.id, "UTR 1234"));
    const c = (await db.query<{ upi_claimed_at: string | null; upi_reference: string }>("select upi_claimed_at, upi_reference from orders where id = $1", [o.id])).rows[0];
    expect(c.upi_claimed_at).not.toBeNull();
    expect(c.upi_reference).toBe("UTR 1234");
    const cashOrder = await order([{ item_id: tea.id, qty: 1 }]);
    await expect(db.tx((t) => claimUpi(t, cashOrder.id, null))).rejects.toThrow(/paid at the counter/);
    for (const s of ["accepted", "preparing", "ready"] as const) await db.tx((t) => transition(t, o.id, s, staff));
    await expect(db.tx((t) => leaveFeedback(t, o.id, 4, "Too early"))).rejects.toThrow(/once it's served/); // ready, not yet collected
    const { recordPayment } = await import("@/server/orders");
    const total = (await db.query<{ total: number }>("select total from orders where id = $1", [o.id])).rows[0].total;
    await db.tx((t) => recordPayment(t, o.id, { method: "upi", amount: Number(total), reference: "UTR 1234" }, null as never));
    await db.tx((t) => transition(t, o.id, "completed", staff));
    await db.tx((t) => leaveFeedback(t, o.id, 4, "Nice tea"));
    await db.tx((t) => leaveFeedback(t, o.id, 5, "Even better"));
    const f = (await db.query<{ rating: number; comment: string }>("select rating, comment from order_feedback where order_id = $1", [o.id])).rows;
    expect(f).toEqual([{ rating: 5, comment: "Even better" }]);
  });
});

describe("close the day", () => {
  it("expected = float + cash in − paid out; short/over = counted − expected", async () => {
    const { closeDay, dayFigures } = await import("@/server/service");
    const { recordPayment } = await import("@/server/orders");
    const tea = await item("classic-tea");
    const o = await order([{ item_id: tea.id, qty: 5 }]);
    const total = (await db.query<{ total: number }>("select total from orders where id = $1", [o.id])).rows[0].total;
    await db.tx((t) => recordPayment(t, o.id, { method: "cash", amount: Number(total), reference: "" }, null as never));
    const before = await dayFigures(today(), db);
    expect(before.cash_received).toBeGreaterThanOrEqual(Number(total));
    const admin = (await db.query<{ id: string }>("select id from users limit 1")).rows[0].id;
    const r = await db.tx((t) => closeDay(t, { day: today(), opening_float: 500, paid_out: 100, counted: 500 + before.cash_received - 100 - 20, note: "" }, admin));
    expect(Number((r.closing as { expected_cash: number }).expected_cash)).toBe(500 + before.cash_received - 100);
    expect(Number((r.closing as { difference: number }).difference)).toBe(-20);
    const again = await db.tx((t) => closeDay(t, { day: today(), opening_float: 500, paid_out: 100, counted: 500 + before.cash_received - 100, note: "recount" }, admin));
    expect(again.reclosed).toBe(true);
    expect(Number((again.closing as { difference: number }).difference)).toBe(0);
  });
});

describe("planning and insights (pure)", () => {
  it("shopping list covers the days and rounds to buyable amounts; usage check flags gaps", async () => {
    const { shoppingList, usageCheck, roundPurchase } = await import("@/lib/analytics");
    const now = Date.parse("2026-11-21T12:00:00Z");
    const milk = { id: "m", name: "Milk", base_unit: "ml", display_unit: "L", stock_qty: 2000, min_qty: 1000, avg_cost: 0.06, supplier: null };
    const usage = [{ item_id: "m", sold: 14000, used: 0, wasted: 0, count_difference: -2000, counts: 1, first_movement_at: "2026-11-01T00:00:00Z" }];
    const list = shoppingList([milk], usage, 2, now);
    // 1 L/day × 2 days + 1 L minimum − 2 L on hand = 1 L → rounded to 1 L (500 ml steps)
    expect(list[0].buy).toBe(1000);
    expect(list[0].daysLeft).toBe(2);
    expect(roundPurchase(1100, "kg")).toBe(1500);
    const check = usageCheck([milk], usage);
    expect(check[0].gap).toBe(2000);
    expect(check[0].status).toBe("watch"); // 2000 / 14000 = 14.3 %: between 5 % and 15 %
    expect(usageCheck([milk], [{ ...usage[0], count_difference: -3000 }])[0].status).toBe("high"); // 21 %
  });

  it("classifies menu items into stars, plowhorses, puzzles and dogs", async () => {
    const { menuEngineering } = await import("@/lib/analytics");
    const r = menuEngineering(
      [
        { menu_item_id: "a", name: "Star", qty: 100, sales: 10000, cost: 4000 }, // ₹60/unit
        { menu_item_id: "b", name: "Plow", qty: 100, sales: 5000, cost: 4000 }, // ₹10/unit
        { menu_item_id: "c", name: "Puzzle", qty: 5, sales: 1000, cost: 200 }, // ₹160/unit
        { menu_item_id: "d", name: "Dog", qty: 5, sales: 100, cost: 80 }, // ₹4/unit
      ],
      [],
    );
    const k = Object.fromEntries(r.rows.map((x) => [x.name, x.klass]));
    expect(k).toEqual({ Star: "star", Plow: "plowhorse", Puzzle: "puzzle", Dog: "dog" });
  });
});
