import "server-only";
import { z } from "zod";
import { q, type Queryable } from "./db";
import { bad, conflict, notFound, type Ctx } from "./http";
import { audit, diff } from "./audit";
import { receivePurchase } from "./inventory";
import { round2 } from "@/lib/pricing";
import { UNITS, baseOf, isUnit } from "@/lib/units";

const money = z.number().min(0).max(10_000_000);
const optUuid = z.string().uuid().nullable().optional().transform((v) => v ?? null);

export const InvItemSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(80),
    sku: z.string().trim().max(40).default(""),
    category_id: optUuid,
    display_unit: z.string().refine(isUnit, "Choose a unit"),
    min_qty: z.number().min(0).max(1e9).default(0),
    track_expiry: z.boolean().default(false),
    is_sellable: z.boolean().default(false),
    sell_unit_name: z.string().trim().max(30).default(""),
    sell_unit_qty: z.number().positive().max(1e9).nullable().default(null),
    retail_price: money.nullable().default(null),
    wholesale_price: money.nullable().default(null),
    default_supplier_id: optUuid,
  })
  .superRefine((v, c) => {
    if (v.is_sellable) {
      if (!v.sell_unit_name) c.addIssue({ code: "custom", path: ["sell_unit_name"], message: "Name the unit you sell, e.g. “500 g pack”" });
      if (!v.sell_unit_qty) c.addIssue({ code: "custom", path: ["sell_unit_qty"], message: "How much stock one unit uses" });
      if (v.retail_price === null && v.wholesale_price === null) c.addIssue({ code: "custom", path: ["retail_price"], message: "Set a retail or wholesale price" });
    }
  });
export type InvItemInput = z.infer<typeof InvItemSchema>;

/** Inventory list with valuation, low-stock and expiry signals. */
export async function listInventory(db: Queryable | null = null, opts: { includeInactive?: boolean } = {}) {
  const run = db ? db.query.bind(db) : q;
  const { rows } = await run<{
    id: string;
    name: string;
    sku: string | null;
    category_id: string | null;
    category: string | null;
    base_unit: string;
    display_unit: string;
    stock_qty: number;
    min_qty: number;
    avg_cost: number | null;
    track_expiry: boolean;
    is_sellable: boolean;
    sell_unit_name: string;
    sell_unit_qty: number | null;
    retail_price: number | null;
    wholesale_price: number | null;
    default_supplier_id: string | null;
    supplier: string | null;
    is_active: boolean;
    next_expiry: string | null;
    expiring_qty: number | null;
    used_in: number;
    last_purchase_cost: number | null;
    updated_at: string;
  }>(
    `select i.id, i.name, i.sku, i.category_id, c.name as category, i.base_unit, i.display_unit, i.stock_qty, i.min_qty, i.avg_cost,
            i.track_expiry, i.is_sellable, i.sell_unit_name, i.sell_unit_qty, i.retail_price, i.wholesale_price, i.default_supplier_id,
            s.name as supplier, i.is_active, i.updated_at,
            (select min(b.expiry_date)::text from inventory_batches b where b.item_id = i.id and b.qty_remaining > 0 and b.expiry_date is not null) as next_expiry,
            (select sum(b.qty_remaining) from inventory_batches b where b.item_id = i.id and b.qty_remaining > 0
                and b.expiry_date is not null and b.expiry_date <= (now() at time zone 'Asia/Kolkata')::date + 7) as expiring_qty,
            ((select count(*) from recipe_lines r join menu_items m on m.id = r.menu_item_id and m.is_active where r.inventory_item_id = i.id)
             + (select count(*) from modifier_recipe_lines r join modifiers m on m.id = r.modifier_id and m.is_active where r.inventory_item_id = i.id))::int as used_in,
            (select pl.unit_cost from purchase_lines pl join purchases p on p.id = pl.purchase_id and p.status = 'received'
              where pl.item_id = i.id order by p.purchased_on desc, p.created_at desc limit 1) as last_purchase_cost
       from inventory_items i
       left join inventory_categories c on c.id = i.category_id
       left join suppliers s on s.id = i.default_supplier_id
      ${opts.includeInactive ? "" : "where i.is_active"}
      order by c.sort nulls last, c.name nulls last, i.name`,
  );
  return rows.map((r) => {
    const value = r.avg_cost === null ? null : round2(Math.max(0, Number(r.stock_qty)) * Number(r.avg_cost));
    const unitCost = r.avg_cost !== null && r.sell_unit_qty ? Number(r.avg_cost) * Number(r.sell_unit_qty) : null;
    const margin = (price: number | null) => (price === null || unitCost === null || price <= 0 ? null : (price - unitCost) / price);
    return {
      ...r,
      value,
      low: Number(r.min_qty) > 0 && Number(r.stock_qty) <= Number(r.min_qty),
      out: Number(r.stock_qty) <= 0,
      sell_unit_cost: unitCost === null ? null : round2(unitCost),
      retail_margin: margin(r.retail_price),
      wholesale_margin: margin(r.wholesale_price),
    };
  });
}
export type InventoryRow = Awaited<ReturnType<typeof listInventory>>[number];

export async function saveInventoryItem(db: Queryable, ctx: Ctx, id: string | null, input: InvItemInput) {
  const base = baseOf(input.display_unit as (typeof UNITS)[number]["value"]);
  const values = {
    name: input.name,
    sku: input.sku || null,
    category_id: input.category_id,
    display_unit: input.display_unit,
    min_qty: input.min_qty,
    track_expiry: input.track_expiry,
    is_sellable: input.is_sellable,
    sell_unit_name: input.is_sellable ? input.sell_unit_name : "",
    sell_unit_qty: input.is_sellable ? input.sell_unit_qty : null,
    retail_price: input.is_sellable ? input.retail_price : null,
    wholesale_price: input.is_sellable ? input.wholesale_price : null,
    default_supplier_id: input.default_supplier_id,
  };
  if (!id) {
    const { rows } = await db.query<{ id: string }>(
      `insert into inventory_items (name, sku, category_id, base_unit, display_unit, min_qty, track_expiry, is_sellable, sell_unit_name, sell_unit_qty, retail_price, wholesale_price, default_supplier_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [values.name, values.sku, values.category_id, base, values.display_unit, values.min_qty, values.track_expiry, values.is_sellable, values.sell_unit_name, values.sell_unit_qty, values.retail_price, values.wholesale_price, values.default_supplier_id],
    );
    await audit(db, ctx, "create", "inventory_item", rows[0].id, `Added inventory item ${input.name}`, values);
    return rows[0].id;
  }
  const before = (await db.query<Record<string, unknown> & { base_unit: string }>(
    "select name, sku, category_id, base_unit, display_unit, min_qty, track_expiry, is_sellable, sell_unit_name, sell_unit_qty, retail_price, wholesale_price, default_supplier_id from inventory_items where id = $1 and is_active",
    [id],
  )).rows[0];
  if (!before) throw notFound("Inventory item");
  // Stock and recipes are stored in the base unit, so the unit family can't change once created.
  if (before.base_unit !== base) throw bad(`This item is measured in ${before.base_unit}. Pick a unit of the same kind.`, { display_unit: "Same kind of unit only" });
  await db.query(
    `update inventory_items set name=$2, sku=$3, category_id=$4, display_unit=$5, min_qty=$6, track_expiry=$7, is_sellable=$8, sell_unit_name=$9,
            sell_unit_qty=$10, retail_price=$11, wholesale_price=$12, default_supplier_id=$13, updated_at=now() where id=$1`,
    [id, values.name, values.sku, values.category_id, values.display_unit, values.min_qty, values.track_expiry, values.is_sellable, values.sell_unit_name, values.sell_unit_qty, values.retail_price, values.wholesale_price, values.default_supplier_id],
  );
  const { base_unit: _b, ...b } = before;
  void _b;
  await audit(db, ctx, "update", "inventory_item", id, `Updated inventory item ${input.name}`, diff(b, values));
  return id;
}

/** Soft-delete. Refused while a dish or option still uses it in its recipe. */
export async function archiveInventoryItem(db: Queryable, ctx: Ctx, id: string) {
  const { rows } = await db.query<{ name: string }>("select name from inventory_items where id = $1 and is_active for update", [id]);
  if (!rows[0]) throw notFound("Inventory item");
  const used = await db.query<{ name: string }>(
    `select m.name from recipe_lines r join menu_items m on m.id = r.menu_item_id and m.is_active where r.inventory_item_id = $1
     union select g.name || ' — ' || m.name from modifier_recipe_lines r join modifiers m on m.id = r.modifier_id and m.is_active
       join modifier_groups g on g.id = m.group_id where r.inventory_item_id = $1 limit 6`,
    [id],
  );
  if (used.rows.length) throw conflict(`${rows[0].name} is used in recipes (${used.rows.map((u) => u.name).join(", ")}). Remove it from those recipes first.`);
  await db.query("update inventory_items set is_active = false, updated_at = now() where id = $1", [id]);
  await audit(db, ctx, "archive", "inventory_item", id, `Archived inventory item ${rows[0].name}`);
}

/* ── Suppliers ─────────────────────────────────────────────────────────── */

export const SupplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier's name").max(80),
  contact_name: z.string().trim().max(60).default(""),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?\d[\d\s-]{6,15})?$/, "Enter a valid phone number")
    .default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([0-9]{2}[A-Z0-9]{13})?$/, "GSTIN is 15 characters")
    .default(""),
  address: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(500).default(""),
  is_active: z.boolean().default(true),
});

/* ── Purchases ─────────────────────────────────────────────────────────── */

export const PurchaseSchema = z.object({
  supplier_id: optUuid,
  invoice_no: z.string().trim().max(40).default(""),
  purchased_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  tax: money.default(0),
  amount_paid: money.default(0),
  notes: z.string().trim().max(500).default(""),
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.number().positive("Quantity must be more than 0").max(1e9), // base units
        line_total: money, // what was paid for this line, before tax
        expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      }),
    )
    .min(1, "Add at least one item")
    .max(100),
});

export async function createPurchase(db: Queryable, ctx: Ctx, input: z.infer<typeof PurchaseSchema>) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (input.purchased_on > today) throw bad("The purchase date can't be in the future.", { purchased_on: "Can't be in the future" });
  const ids = [...new Set(input.lines.map((l) => l.item_id))];
  const { rows: items } = await db.query<{ id: string; name: string; track_expiry: boolean }>("select id, name, track_expiry from inventory_items where id = any($1::uuid[]) and is_active", [ids]);
  if (items.length !== ids.length) throw bad("An item on this purchase is no longer in inventory.");
  for (const l of input.lines) {
    const it = items.find((i) => i.id === l.item_id)!;
    if (it.track_expiry && !l.expiry_date) throw bad(`Enter the expiry date for ${it.name}.`);
  }
  if (input.supplier_id) {
    const s = await db.query("select 1 from suppliers where id = $1", [input.supplier_id]);
    if (!s.rows.length) throw bad("That supplier no longer exists.");
  }
  const subtotal = round2(input.lines.reduce((s, l) => s + l.line_total, 0));
  const total = round2(subtotal + input.tax);
  if (input.amount_paid > total + 0.001) throw bad("Amount paid is more than the bill total.", { amount_paid: "More than the total" });
  const status = input.amount_paid >= total - 0.001 ? "paid" : input.amount_paid > 0 ? "partial" : "unpaid";
  const { rows } = await db.query<{ id: string; number: number }>(
    `insert into purchases (supplier_id, invoice_no, purchased_on, subtotal, tax, total, amount_paid, payment_status, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, number`,
    [input.supplier_id, input.invoice_no, input.purchased_on, subtotal, input.tax, total, input.amount_paid, status, input.notes, ctx.user?.id ?? null],
  );
  const p = rows[0];
  for (const l of input.lines) {
    await db.query("insert into purchase_lines (purchase_id, item_id, qty, unit_cost, line_total, expiry_date) values ($1,$2,$3,$4,$5,$6)", [
      p.id,
      l.item_id,
      l.qty,
      l.line_total / l.qty,
      l.line_total,
      l.expiry_date ?? null,
    ]);
  }
  await receivePurchase(db, p.id, ctx.user?.id ?? null);
  await audit(db, ctx, "create", "purchase", p.id, `Recorded purchase #${p.number} (₹${total})`, { lines: input.lines.length, total, supplier_id: input.supplier_id });
  return p;
}
