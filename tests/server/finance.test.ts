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

async function newItem(name: string, unit: string, extra: Record<string, unknown> = {}) {
  const { saveInventoryItem, InvItemSchema } = await import("@/server/inventory-admin");
  return db.tx((t) => saveInventoryItem(t, ctx, null, InvItemSchema.parse({ name, display_unit: unit, ...extra })));
}

describe("purchases, stock and P&L", () => {
  it("prices stock from purchases, books COGS on sale and reports a real P&L", async () => {
    const { createPurchase } = await import("@/server/inventory-admin");
    const { adjustStock } = await import("@/server/inventory");
    const { createOrder, transition, recordPayment } = await import("@/server/orders");
    const { profitAndLoss } = await import("@/server/finance");

    // Milk: 10 L bought for ₹600 → ₹0.06 / ml. Coffee: 1 kg for ₹1,000 → ₹1 / g.
    const milk = await newItem("Milk", "L", { min_qty: 2000 });
    const coffee = await newItem("Coffee beans", "kg");
    await db.tx((t) =>
      createPurchase(t, ctx, {
        supplier_id: null,
        invoice_no: "INV-1",
        purchased_on: today(),
        tax: 50,
        amount_paid: 0,
        notes: "",
        lines: [
          { item_id: milk, qty: 10000, line_total: 600 },
          { item_id: coffee, qty: 1000, line_total: 1000 },
        ],
      }),
    );
    const inv = await db.query<{ name: string; stock_qty: number; avg_cost: number }>("select name, stock_qty, avg_cost from inventory_items where id = any($1::uuid[]) order by name", [[milk, coffee]]);
    expect(inv.rows.map((r) => [r.name, r.stock_qty, Number(r.avg_cost)])).toEqual([
      ["Coffee beans", 1000, 1],
      ["Milk", 10000, 0.06],
    ]);
    const p = (await db.query<{ total: number; payment_status: string }>("select total, payment_status from purchases")).rows[0];
    expect(p).toEqual({ total: 1650, payment_status: "unpaid" });

    // Cappuccino recipe: 150 ml milk + 18 g coffee = ₹9 + ₹18 = ₹27 cost
    const capp = (await db.query<{ id: string; price: number }>("select id, price from menu_items where slug = 'cappuccino'")).rows[0];
    await db.query("insert into recipe_lines (menu_item_id, inventory_item_id, qty) values ($1,$2,150), ($1,$3,18)", [capp.id, milk, coffee]);

    const table = (await db.query<{ id: string }>("select id from dining_tables order by sort limit 1")).rows[0].id;
    const o = await db.tx((t) =>
      createOrder(t, { lines: [{ item_id: capp.id, qty: 2 }], tier: "retail", customerId: null, type: "dine_in", channel: "pos", tableId: table, customerName: "", customerPhone: "", notes: "", idempotencyKey: key(), accessHash: null, createdBy: null, autoAccept: true }),
    );
    for (const s of ["preparing", "ready", "served"] as const) await db.tx((t) => transition(t, o.id, s, staff));
    const order = (await db.query<{ total: number }>("select total from orders where id = $1", [o.id])).rows[0];
    await db.tx((t) => recordPayment(t, o.id, { method: "cash", amount: order.total, reference: "" }, null as never));
    await db.tx((t) => transition(t, o.id, "completed", staff));

    const after = (await db.query<{ stock_qty: number }>("select stock_qty from inventory_items where id = $1", [milk])).rows[0];
    expect(after.stock_qty).toBe(9700);

    // Wastage of 500 ml milk = ₹30; an expense of ₹200.
    await db.tx((t) => adjustStock(t, { item_id: milk, kind: "wastage", qty: 500, reason: "Spoiled" }, null));
    const cat = (await db.query<{ id: string }>("select id from expense_categories order by sort limit 1")).rows[0].id;
    await db.query("insert into expenses (category_id, amount, spent_on) values ($1, 200, $2)", [cat, today()]);
    await db.query("insert into expenses (category_id, amount, spent_on, is_void) values ($1, 999, $2, true)", [cat, today()]);

    const r = await profitAndLoss({ from: today(), to: today(), group: "day" });
    const revenue = capp.price * 2; // GST excluded
    expect(r.totals.orders).toBe(1);
    expect(r.totals.revenue).toBe(revenue);
    expect(r.totals.revenue_wholesale).toBe(0);
    expect(r.totals.cogs).toBe(54);
    expect(r.totals.gross_profit).toBe(revenue - 54);
    expect(r.totals.wastage).toBe(30);
    expect(r.totals.expenses).toBe(200); // voided expense excluded
    expect(r.totals.net_profit).toBe(revenue - 54 - 30 - 200);
    expect(r.totals.gst).toBe(Math.round(revenue * 0.05 * 100) / 100);
    expect(r.purchases.total).toBe(1650);
    expect(r.warnings.uncosted_lines).toBe(0);
  });

  it("splits wholesale revenue and blocks selling stock that isn't there", async () => {
    const { createOrder, transition, recordPayment } = await import("@/server/orders");
    const { adjustStock } = await import("@/server/inventory");
    const { profitAndLoss } = await import("@/server/finance");
    // Granola sold in 500 g packs: retail ₹250, wholesale ₹200. Opening stock 1 kg at ₹0.2/g → ₹100 per pack.
    const granola = await newItem("Granola", "kg", { is_sellable: true, sell_unit_name: "500 g pack", sell_unit_qty: 500, retail_price: 250, wholesale_price: 200 });
    await db.tx((t) => adjustStock(t, { item_id: granola, kind: "opening", qty: 1000, unit_cost: 0.2 }, null));

    const base = { customerId: null, type: "takeaway" as const, channel: "pos" as const, tableId: null, customerName: "Shop", customerPhone: "", notes: "", accessHash: null, createdBy: null, autoAccept: true, lines: [] };
    await expect(db.tx((t) => createOrder(t, { ...base, tier: "wholesale", products: [{ product_id: granola, qty: 3 }], idempotencyKey: key() }))).rejects.toThrow(/Not enough Granola/);

    const o = await db.tx((t) => createOrder(t, { ...base, tier: "wholesale", products: [{ product_id: granola, qty: 2 }], idempotencyKey: key() }));
    for (const s of ["preparing", "ready"] as const) await db.tx((t) => transition(t, o.id, s, staff));
    const total = (await db.query<{ total: number }>("select total from orders where id = $1", [o.id])).rows[0].total;
    await db.tx((t) => recordPayment(t, o.id, { method: "upi", amount: total, reference: "" }, null as never));
    await db.tx((t) => transition(t, o.id, "completed", staff));

    const r = await profitAndLoss({ from: today(), to: today(), group: "month" });
    expect(r.buckets).toHaveLength(1);
    expect(r.totals.revenue_wholesale).toBe(400);
    expect(r.totals.orders_wholesale).toBe(1);
    const line = (await db.query<{ unit_cost: number }>("select unit_cost from order_items where order_id = $1", [o.id])).rows[0];
    expect(Number(line.unit_cost)).toBe(100);
  });

  it("refuses to cancel a purchase whose stock was already used", async () => {
    const { createPurchase } = await import("@/server/inventory-admin");
    const { cancelPurchase, adjustStock } = await import("@/server/inventory");
    const sugar = await newItem("Sugar", "kg");
    const p = await db.tx((t) => createPurchase(t, ctx, { supplier_id: null, invoice_no: "", purchased_on: today(), tax: 0, amount_paid: 100, notes: "", lines: [{ item_id: sugar, qty: 2000, line_total: 100 }] }));
    await db.tx((t) => adjustStock(t, { item_id: sugar, kind: "wastage", qty: 1000, reason: "Spilled" }, null));
    await expect(db.tx((t) => cancelPurchase(t, p.id, null))).rejects.toThrow(/already been used/);
  });
});
