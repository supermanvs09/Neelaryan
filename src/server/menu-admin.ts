import "server-only";
import { z } from "zod";
import type { Queryable } from "./db";
import { bad, conflict, notFound } from "./http";
import { audit, diff } from "./audit";
import type { Ctx } from "./http";

const money = z.coerce.number().min(0, "Must be 0 or more").max(100000);
const cost = z.coerce.number().min(0).max(100000).nullable();

export const ItemSchema = z.object({
  category_id: z.string().uuid("Choose a category"),
  name: z.string().trim().min(1, "Enter a name").max(80),
  description: z.string().trim().max(300).default(""),
  price: money,
  cost_price: cost.default(null),
  diet: z.enum(["veg", "egg", "nonveg"]),
  tags: z.array(z.enum(["bestseller", "new", "healthy", "protein", "spicy", "recommended"])).max(6).default([]),
  image_id: z.string().uuid().nullable().default(null),
  visual: z.enum(["art", "bowl", "glass"]).default("art"),
  art_kind: z.string().max(20).default("coffee"),
  tint: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(2).default([]),
  status: z.enum(["available", "sold_out", "hidden"]).default("available"),
  is_featured: z.boolean().default(false),
  variants: z
    .array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(40), price: money, cost_price: cost.default(null), is_default: z.boolean().default(false) }))
    .max(8)
    .default([]),
  group_ids: z.array(z.string().uuid()).max(12).default([]),
  default_modifier_ids: z.array(z.string().uuid()).max(40).default([]),
  recipe: z.array(z.object({ inventory_item_id: z.string().uuid(), qty: z.coerce.number().positive().max(1000000) })).max(40).default([]),
});
export type ItemInput = z.infer<typeof ItemSchema>;

export const CategorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  description: z.string().trim().max(200).default(""),
  art_kind: z.string().max(20).default("coffee"),
  is_active: z.boolean().default(true),
});

export const GroupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60),
    description: z.string().trim().max(200).default(""),
    selection: z.enum(["single", "multi"]),
    min_select: z.coerce.number().int().min(0).max(20).default(0),
    max_select: z.coerce.number().int().min(1).max(40).nullable().default(null),
    is_active: z.boolean().default(true),
    modifiers: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(1, "Enter an option name").max(60),
          price: money,
          cost_price: cost.default(null),
          visual_key: z.string().max(40).nullable().default(null),
          is_active: z.boolean().default(true),
          recipe: z.array(z.object({ inventory_item_id: z.string().uuid(), qty: z.coerce.number().positive() })).max(20).default([]),
        }),
      )
      .min(1, "Add at least one option")
      .max(40),
  })
  .refine((g) => g.selection === "multi" || g.min_select <= 1, { message: "A single-choice group can require at most 1.", path: ["min_select"] })
  .refine((g) => g.max_select === null || g.max_select >= g.min_select, { message: "Maximum must be at least the minimum.", path: ["max_select"] });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "item";

async function uniqueSlug(db: Queryable, table: "menu_items" | "menu_categories", name: string, exceptId: string | null) {
  const base = slugify(name);
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const { rows } = await db.query(`select 1 from ${table} where slug = $1 and ($2::uuid is null or id <> $2)`, [s, exceptId]);
    if (!rows.length) return s;
  }
  throw conflict("Too many items share that name.");
}

export async function saveItem(db: Queryable, ctx: Ctx, id: string | null, input: ItemInput) {
  const before = id ? (await db.query<Record<string, unknown>>("select name, price, cost_price, status, category_id, description, diet from menu_items where id = $1 and is_active", [id])).rows[0] : null;
  if (id && !before) throw notFound("Menu item");
  const cat = await db.query("select 1 from menu_categories where id = $1", [input.category_id]);
  if (!cat.rows.length) throw bad("Choose a category.", { category_id: "Choose a category." });
  if (input.variants.length && !input.variants.some((v) => v.is_default)) input.variants[0].is_default = true;

  // modifiers marked as included must belong to the item's groups
  if (input.default_modifier_ids.length) {
    const { rows } = await db.query<{ id: string }>("select id from modifiers where id = any($1::uuid[]) and group_id = any($2::uuid[])", [input.default_modifier_ids, input.group_ids]);
    if (rows.length !== new Set(input.default_modifier_ids).size) throw bad("An included option doesn't belong to the item's add-on groups.");
  }
  const slug = await uniqueSlug(db, "menu_items", input.name, id);
  const values = [
    input.category_id,
    input.name,
    slug,
    input.description,
    input.price,
    input.cost_price,
    input.diet,
    input.tags,
    input.image_id,
    input.visual,
    input.art_kind,
    input.tint,
    input.status,
    input.is_featured,
  ];
  let itemId = id;
  if (id) {
    await db.query(
      `update menu_items set category_id=$1, name=$2, slug=$3, description=$4, price=$5, cost_price=$6, diet=$7, tags=$8, image_id=$9, visual=$10,
         art_kind=$11, tint=$12, status=$13, is_featured=$14, updated_at=now() where id=$15`,
      [...values, id],
    );
  } else {
    const sort = (await db.query<{ s: number }>("select coalesce(max(sort), 0) + 1 as s from menu_items where category_id = $1", [input.category_id])).rows[0].s;
    const { rows } = await db.query<{ id: string }>(
      `insert into menu_items (category_id, name, slug, description, price, cost_price, diet, tags, image_id, visual, art_kind, tint, status, is_featured, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
      [...values, sort],
    );
    itemId = rows[0].id;
  }

  // variants: update kept ones, add new ones, deactivate removed ones (past orders keep their names)
  const keep: string[] = [];
  for (const [i, v] of input.variants.entries()) {
    if (v.id) {
      await db.query("update item_variants set name=$2, price=$3, cost_price=$4, is_default=$5, is_active=true, sort=$6 where id=$1 and item_id=$7", [v.id, v.name, v.price, v.cost_price, v.is_default, i, itemId]);
      keep.push(v.id);
    } else {
      const { rows } = await db.query<{ id: string }>("insert into item_variants (item_id, name, price, cost_price, is_default, sort) values ($1,$2,$3,$4,$5,$6) returning id", [itemId, v.name, v.price, v.cost_price, v.is_default, i]);
      keep.push(rows[0].id);
    }
  }
  await db.query("update item_variants set is_active = false where item_id = $1 and not (id = any($2::uuid[]))", [itemId, keep]);

  await db.query("delete from item_modifier_groups where item_id = $1", [itemId]);
  for (const [i, g] of input.group_ids.entries()) await db.query("insert into item_modifier_groups (item_id, group_id, sort) values ($1,$2,$3)", [itemId, g, i]);
  await db.query("delete from item_default_modifiers where item_id = $1", [itemId]);
  for (const m of new Set(input.default_modifier_ids)) await db.query("insert into item_default_modifiers (item_id, modifier_id) values ($1,$2)", [itemId, m]);

  await db.query("delete from recipe_lines where menu_item_id = $1", [itemId]);
  const seen = new Set<string>();
  for (const r of input.recipe) {
    if (seen.has(r.inventory_item_id)) throw bad("An ingredient is listed twice in the recipe.");
    seen.add(r.inventory_item_id);
    await db.query("insert into recipe_lines (menu_item_id, inventory_item_id, qty) values ($1,$2,$3)", [itemId, r.inventory_item_id, r.qty]);
  }

  const after = { name: input.name, price: input.price, cost_price: input.cost_price, status: input.status, category_id: input.category_id, description: input.description, diet: input.diet };
  await audit(db, ctx, id ? "update" : "create", "menu_item", itemId, id ? `Updated menu item “${input.name}”` : `Added menu item “${input.name}” at ₹${input.price}`, id ? { changes: diff(before!, after), recipe_lines: input.recipe.length } : after);
  return itemId!;
}

export async function saveGroup(db: Queryable, ctx: Ctx, id: string | null, input: z.infer<typeof GroupSchema>) {
  let groupId = id;
  if (id) {
    const ok = await db.query("update modifier_groups set name=$2, description=$3, selection=$4, min_select=$5, max_select=$6, is_active=$7 where id=$1", [
      id,
      input.name,
      input.description,
      input.selection,
      input.min_select,
      input.selection === "single" ? 1 : input.max_select,
      input.is_active,
    ]);
    if (!ok.rowCount) throw notFound("Add-on group");
  } else {
    const sort = (await db.query<{ s: number }>("select coalesce(max(sort), 0) + 1 as s from modifier_groups")).rows[0].s;
    const { rows } = await db.query<{ id: string }>("insert into modifier_groups (name, description, selection, min_select, max_select, is_active, sort) values ($1,$2,$3,$4,$5,$6,$7) returning id", [
      input.name,
      input.description,
      input.selection,
      input.min_select,
      input.selection === "single" ? 1 : input.max_select,
      input.is_active,
      sort,
    ]);
    groupId = rows[0].id;
  }
  const keep: string[] = [];
  for (const [i, m] of input.modifiers.entries()) {
    let mid = m.id;
    if (mid) {
      await db.query("update modifiers set name=$2, price=$3, cost_price=$4, visual_key=$5, is_active=$6, sort=$7 where id=$1 and group_id=$8", [mid, m.name, m.price, m.cost_price, m.visual_key, m.is_active, i, groupId]);
    } else {
      mid = (await db.query<{ id: string }>("insert into modifiers (group_id, name, price, cost_price, visual_key, is_active, sort) values ($1,$2,$3,$4,$5,$6,$7) returning id", [groupId, m.name, m.price, m.cost_price, m.visual_key, m.is_active, i])).rows[0].id;
    }
    keep.push(mid);
    await db.query("delete from modifier_recipe_lines where modifier_id = $1", [mid]);
    for (const r of m.recipe) await db.query("insert into modifier_recipe_lines (modifier_id, inventory_item_id, qty) values ($1,$2,$3) on conflict do nothing", [mid, r.inventory_item_id, r.qty]);
  }
  // removed options are switched off (order history keeps their names)
  await db.query("update modifiers set is_active = false where group_id = $1 and not (id = any($2::uuid[]))", [groupId, keep]);
  await db.query("delete from item_default_modifiers where modifier_id in (select id from modifiers where group_id = $1 and not is_active)", [groupId]);
  await audit(db, ctx, id ? "update" : "create", "modifier_group", groupId, `${id ? "Updated" : "Added"} add-on group “${input.name}” (${input.modifiers.length} options)`, {
    options: input.modifiers.map((m) => `${m.name} ₹${m.price}`),
  });
  return groupId!;
}

export async function saveCategory(db: Queryable, ctx: Ctx, id: string | null, input: z.infer<typeof CategorySchema>) {
  const slug = await uniqueSlug(db, "menu_categories", input.name, id);
  if (id) {
    const ok = await db.query("update menu_categories set name=$2, slug=$3, description=$4, art_kind=$5, is_active=$6 where id=$1", [id, input.name, slug, input.description, input.art_kind, input.is_active]);
    if (!ok.rowCount) throw notFound("Category");
  } else {
    const sort = (await db.query<{ s: number }>("select coalesce(max(sort), 0) + 1 as s from menu_categories")).rows[0].s;
    id = (await db.query<{ id: string }>("insert into menu_categories (name, slug, description, art_kind, is_active, sort) values ($1,$2,$3,$4,$5,$6) returning id", [input.name, slug, input.description, input.art_kind, input.is_active, sort])).rows[0].id;
  }
  await audit(db, ctx, "save", "menu_category", id, `Saved category “${input.name}”${input.is_active ? "" : " (hidden)"}`);
  return id;
}
