import { beforeAll, describe, expect, it } from "vitest";
import { freshDb, key } from "./helpers";
import type { Db } from "@/server/db";

let db: Db;
const staff = { userId: null, permissions: ["orders.manage", "kitchen.update", "billing.manage"] as never };

async function itemId(slug: string) {
  return (await db.query<{ id: string }>("select id from menu_items where slug = $1", [slug])).rows[0].id;
}
async function modifierIn(itemSlug: string, visualKey: string) {
  const { rows } = await db.query<{ id: string }>(
    `select m.id from modifiers m join item_modifier_groups g on g.group_id = m.group_id join menu_items i on i.id = g.item_id
      where i.slug = $1 and m.visual_key = $2`,
    [itemSlug, visualKey],
  );
  return rows[0].id;
}

async function placeOrder(lines: { item_id: string; modifier_ids?: string[]; qty: number }[], extra: Record<string, unknown> = {}) {
  const { createOrder } = await import("@/server/orders");
  const table = (await db.query<{ id: string }>("select id from dining_tables order by sort limit 1")).rows[0].id;
  return db.tx((t) =>
    createOrder(t, {
      lines,
      tier: "retail",
      customerId: null,
      type: "dine_in",
      channel: "qr",
      tableId: table,
      customerName: "Asha",
      customerPhone: "9876543210",
      notes: "",
      idempotencyKey: key(),
      accessHash: null,
      createdBy: null,
      autoAccept: false,
      ...extra,
    }),
  );
}

beforeAll(async () => {
  db = await freshDb();
});

describe("seed", () => {
  it("imports the menu, tables, roles and a forced-change admin", async () => {
    const counts = await db.query<{ items: number; tables: number; roles: number }>(
      "select (select count(*) from menu_items) items, (select count(*) from dining_tables) tables, (select count(*) from roles) roles",
    );
    expect(counts.rows[0]).toEqual({ items: 89, tables: 16, roles: 4 });
    const admin = await db.query<{ username: string; must_change_password: boolean; password_hash: string }>("select username, must_change_password, password_hash from users");
    expect(admin.rows[0].username).toBe("admin");
    expect(admin.rows[0].must_change_password).toBe(true);
    expect(admin.rows[0].password_hash.startsWith("scrypt$")).toBe(true);
  });
});

describe("pricing", () => {
  it("charges add-ons but never discounts removed recipe ingredients", async () => {
    const id = await itemId("banana-peanut-butter-oats"); // ₹129, includes banana + peanut butter
    const strawberry = await modifierIn("banana-peanut-butter-oats", "strawberry"); // +15
    const regular = await modifierIn("banana-peanut-butter-oats", "regular-oats");
    const noProtein = await modifierIn("banana-peanut-butter-oats", "no-protein");
    // keep banana off (removed), add strawberry
    const o = await placeOrder([{ item_id: id, modifier_ids: [regular, strawberry, noProtein], qty: 2 }]);
    const { rows } = await db.query<{ unit_price: number; modifiers: { name: string }[] }>("select unit_price, modifiers from order_items where order_id = $1", [o.id]);
    expect(rows[0].unit_price).toBe(144);
    expect(rows[0].modifiers.map((m) => m.name)).toEqual(expect.arrayContaining(["Strawberry", "No Banana", "No Peanut Butter"]));
    // 288 subtotal + 5% GST
    const order = (await db.query<{ subtotal: number; tax: number; total: number }>("select subtotal, tax, total from orders where id = $1", [o.id])).rows[0];
    expect(order).toEqual({ subtotal: 288, tax: 14.4, total: 302.4 });
  });

  it("rejects a sold-out item and an over-limit selection", async () => {
    const id = await itemId("classic-tea");
    await db.query("update menu_items set status = 'sold_out' where id = $1", [id]);
    await expect(placeOrder([{ item_id: id, qty: 1 }])).rejects.toThrow(/sold out/);
    await db.query("update menu_items set status = 'available' where id = $1", [id]);
    const bowl = await itemId("pomegranate-oats");
    const fruits = await Promise.all(["banana", "apple", "kiwi", "mango"].map((k) => modifierIn("pomegranate-oats", k)));
    await expect(placeOrder([{ item_id: bowl, modifier_ids: fruits, qty: 1 }])).rejects.toThrow(/up to 3/);
  });

  it("returns the same order when a request is replayed (no duplicate orders)", async () => {
    const id = await itemId("classic-tea");
    const k = key();
    const a = await placeOrder([{ item_id: id, qty: 1 }], { idempotencyKey: k });
    const b = await placeOrder([{ item_id: id, qty: 1 }], { idempotencyKey: k });
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
  });
});

describe("inventory & recipes", () => {
  it("deducts recipe ingredients when accepted and returns them when cancelled", async () => {
    const { transition } = await import("@/server/orders");
    const { receivePurchase } = await import("@/server/inventory");
    const milk = (await db.query<{ id: string }>("insert into inventory_items (name, base_unit, display_unit) values ('Milk','ml','L') returning id")).rows[0].id;
    const coffee = (await db.query<{ id: string }>("insert into inventory_items (name, base_unit, display_unit) values ('Coffee beans','g','kg') returning id")).rows[0].id;
    // buy 10 L milk @ ₹60/L and 1 kg coffee @ ₹800/kg
    const p = (await db.query<{ id: string }>("insert into purchases (purchased_on, subtotal, total) values (current_date, 1400, 1400) returning id")).rows[0].id;
    await db.query("insert into purchase_lines (purchase_id, item_id, qty, unit_cost, line_total) values ($1,$2,10000,0.06,600),($1,$3,1000,0.8,800)", [p, milk, coffee]);
    await db.tx((t) => receivePurchase(t, p, null));

    const latte = await itemId("cafe-latte");
    await db.query("insert into recipe_lines (menu_item_id, inventory_item_id, qty) values ($1,$2,200),($1,$3,18)", [latte, milk, coffee]);
    const o = await placeOrder([{ item_id: latte, qty: 2 }]);

    // nothing is deducted until the kitchen accepts (cart / new orders don't consume stock)
    let stock = await db.query<{ name: string; stock_qty: number }>("select name, stock_qty from inventory_items where id = any($1::uuid[]) order by name", [[milk, coffee]]);
    expect(stock.rows.map((r) => r.stock_qty)).toEqual([1000, 10000]);

    await db.tx((t) => transition(t, o.id, "accepted", staff));
    stock = await db.query("select name, stock_qty from inventory_items where id = any($1::uuid[]) order by name", [[milk, coffee]]);
    expect(stock.rows.map((r) => r.stock_qty)).toEqual([964, 9600]);
    // unit cost snapshot for COGS: 200 ml × 0.06 + 18 g × 0.8 = 26.4
    const line = await db.query<{ unit_cost: number }>("select unit_cost from order_items where order_id = $1", [o.id]);
    expect(line.rows[0].unit_cost).toBeCloseTo(26.4, 4);

    // accepting twice never double-deducts
    await db.tx((t) => transition(t, o.id, "accepted", staff));
    await db.tx((t) => transition(t, o.id, "cancelled", { ...staff, reason: "Customer left" }));
    stock = await db.query("select name, stock_qty from inventory_items where id = any($1::uuid[]) order by name", [[milk, coffee]]);
    expect(stock.rows.map((r) => r.stock_qty)).toEqual([1000, 10000]);
  });

  it("keeps a weighted average cost across purchases", async () => {
    const { receivePurchase } = await import("@/server/inventory");
    const sugar = (await db.query<{ id: string }>("insert into inventory_items (name, base_unit, display_unit) values ('Sugar','g','kg') returning id")).rows[0].id;
    for (const [qty, cost] of [
      [1000, 0.04],
      [3000, 0.05],
    ]) {
      const p = (await db.query<{ id: string }>("insert into purchases (purchased_on) values (current_date) returning id")).rows[0].id;
      await db.query("insert into purchase_lines (purchase_id, item_id, qty, unit_cost, line_total) values ($1,$2,$3,$4,$5)", [p, sugar, qty, cost, qty * cost]);
      await db.tx((t) => receivePurchase(t, p, null));
    }
    const { rows } = await db.query<{ stock_qty: number; avg_cost: number }>("select stock_qty, avg_cost from inventory_items where id = $1", [sugar]);
    expect(rows[0].stock_qty).toBe(4000);
    expect(rows[0].avg_cost).toBeCloseTo(0.0475, 6);
  });

  it("refuses to sell a retail product that isn't in stock", async () => {
    const { createOrder } = await import("@/server/orders");
    const jar = (
      await db.query<{ id: string }>(
        "insert into inventory_items (name, base_unit, display_unit, is_sellable, sell_unit_name, sell_unit_qty, retail_price, wholesale_price, stock_qty, avg_cost) values ('Honey jar','pcs','pcs',true,'jar',1,250,200,2,150) returning id",
      )
    ).rows[0].id;
    const pos = (qty: number, tier: "retail" | "wholesale") =>
      db.tx((t) =>
        createOrder(t, {
          lines: [],
          products: [{ product_id: jar, qty }],
          tier,
          customerId: null,
          type: "takeaway",
          channel: "pos",
          tableId: null,
          customerName: "",
          customerPhone: "",
          notes: "",
          idempotencyKey: key(),
          accessHash: null,
          createdBy: null,
          autoAccept: true,
        }),
      );
    await expect(pos(3, "retail")).rejects.toThrow(/Not enough Honey jar/);
    const o = await pos(2, "wholesale");
    const { rows } = await db.query<{ total: number; subtotal: number; price_tier: string }>("select total, subtotal, price_tier from orders where id = $1", [o.id]);
    expect(rows[0]).toMatchObject({ subtotal: 400, price_tier: "wholesale" });
    const s = await db.query<{ stock_qty: number }>("select stock_qty from inventory_items where id = $1", [jar]);
    expect(s.rows[0].stock_qty).toBe(0);
  });
});

describe("payments, completion and loyalty", () => {
  it("requires payment to complete, awards points once, reverses them on refund", async () => {
    const { transition, recordPayment, recordRefund } = await import("@/server/orders");
    const customer = (await db.query<{ id: string }>("insert into customers (name, phone, phone_verified_at) values ('Ravi','9123456780', now()) returning id")).rows[0].id;
    const id = await itemId("whey-protein-oats"); // ₹179
    const o = await placeOrder([{ item_id: id, qty: 2 }], { customerId: customer }); // 358 + GST = 375.9
    for (const s of ["accepted", "preparing", "ready", "served"] as const) await db.tx((t) => transition(t, o.id, s, staff));
    await expect(db.tx((t) => transition(t, o.id, "completed", staff))).rejects.toThrow(/payment/);
    await expect(db.tx((t) => recordPayment(t, o.id, { method: "cash", amount: 500, reference: "" }, (null as unknown) as string))).rejects.toThrow(/due/);
    await db.tx((t) => recordPayment(t, o.id, { method: "upi", amount: 375.9, reference: "UTR1" }, (null as unknown) as string));
    await db.tx((t) => transition(t, o.id, "completed", staff));

    // default rule: 5 points per ₹100 of the pre-tax bill → floor(3.58 × 5) = 17
    let c = (await db.query<{ points_balance: number; visits: number }>("select points_balance, visits from customers where id = $1", [customer])).rows[0];
    expect(c).toEqual({ points_balance: 17, visits: 1 });

    // calling earn again (e.g. retried request) never double-awards
    const { earnForOrder } = await import("@/server/loyalty");
    await db.tx((t) => earnForOrder(t, o.id));
    c = (await db.query<{ points_balance: number; visits: number }>("select points_balance, visits from customers where id = $1", [customer])).rows[0];
    expect(c.points_balance).toBe(17);

    await db.tx((t) => recordRefund(t, o.id, { method: "upi", amount: 375.9, reference: "R1" }, (null as unknown) as string));
    c = (await db.query<{ points_balance: number; visits: number }>("select points_balance, visits from customers where id = $1", [customer])).rows[0];
    expect(c.points_balance).toBe(0);
  });

  it("spends points first-expiring-first and restores them if the order is cancelled", async () => {
    const { grantPoints } = await import("@/server/loyalty");
    const { transition } = await import("@/server/orders");
    const customer = (await db.query<{ id: string }>("insert into customers (name, phone) values ('Meera','9000000001') returning id")).rows[0].id;
    await db.tx((t) => grantPoints(t, customer, 300, { kind: "promo", note: "welcome" }));
    const id = await itemId("chocolate-overload"); // ₹139
    // 100 points × ₹0.25 = ₹25 off; capped at 50 % of the bill
    const o = await placeOrder([{ item_id: id, qty: 1 }], { customerId: customer, usePoints: 100 });
    const ord = (await db.query<{ discount: number; points_used: number }>("select discount, points_used from orders where id = $1", [o.id])).rows[0];
    expect(ord).toEqual({ discount: 25, points_used: 100 });
    expect((await db.query<{ points_balance: number }>("select points_balance from customers where id = $1", [customer])).rows[0].points_balance).toBe(200);
    await db.tx((t) => transition(t, o.id, "cancelled", { ...staff, reason: "Changed mind" }));
    expect((await db.query<{ points_balance: number }>("select points_balance from customers where id = $1", [customer])).rows[0].points_balance).toBe(300);
  });

  it("issues a reward code and applies it once", async () => {
    const { grantPoints, issueReward } = await import("@/server/loyalty");
    const customer = (await db.query<{ id: string }>("insert into customers (name, phone) values ('Kabir','9000000002') returning id")).rows[0].id;
    await db.tx((t) => grantPoints(t, customer, 200, { kind: "adjust" }));
    const coffee = await itemId("classic-cold-coffee"); // ₹99
    const reward = (
      await db.query<{ id: string }>("insert into rewards (name, points_cost, kind, menu_item_id) values ('Free cold coffee', 150, 'free_item', $1) returning id", [coffee])
    ).rows[0].id;
    const red = await db.tx((t) => issueReward(t, customer, reward));
    expect(red.code).toMatch(/^NR-[A-Z2-9]{6}$/);
    const o = await placeOrder([{ item_id: coffee, qty: 1 }], { customerId: customer, rewardCode: red.code });
    expect((await db.query<{ discount: number }>("select discount from orders where id = $1", [o.id])).rows[0].discount).toBe(99);
    await expect(placeOrder([{ item_id: coffee, qty: 1 }], { customerId: customer, rewardCode: red.code })).rejects.toThrow(/already been used/);
  });
});

describe("audit log", () => {
  it("is append-only", async () => {
    await db.query("insert into audit_logs (actor, action, entity, summary) values ('test','x','y','z')");
    await expect(db.query("update audit_logs set summary = 'changed'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from audit_logs")).rejects.toThrow(/append-only/);
  });
});
