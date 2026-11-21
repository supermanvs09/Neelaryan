import "server-only";
import { q, type Queryable } from "./db";
import { publicUrl, supabaseStorageEnabled } from "./storage";

export interface MenuModifier {
  id: string;
  name: string;
  price: number;
  visual_key: string | null;
  is_active: boolean;
  sort: number;
}
export interface MenuModifierGroup {
  id: string;
  name: string;
  description: string;
  selection: "single" | "multi";
  min_select: number;
  max_select: number | null;
  is_active: boolean;
  sort: number;
  modifiers: MenuModifier[];
}
export interface MenuVariant {
  id: string;
  name: string;
  price: number;
  cost_price: number | null;
  is_default: boolean;
  is_active: boolean;
  sort: number;
}
export interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  cost_price: number | null;
  diet: "veg" | "egg" | "nonveg";
  tags: string[];
  image_id: string | null;
  /** set when the photo lives in Supabase Storage */
  image_path: string | null;
  art_kind: string;
  tint: string[];
  visual: "art" | "bowl" | "glass";
  status: "available" | "sold_out" | "hidden";
  is_active: boolean;
  is_featured: boolean;
  sort: number;
  variants: MenuVariant[];
  group_ids: string[];
  default_modifier_ids: string[];
}
export interface MenuCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  art_kind: string;
  sort: number;
  is_active: boolean;
}

/** Photo address: Supabase Storage CDN when stored there, otherwise served by the app. */
export const imageUrl = (id: string | null, path: string | null = null) => (path && supabaseStorageEnabled() ? publicUrl(path) : id ? `/api/images/${id}` : null);

/** Full menu with everything joined. `scope: "public"` hides inactive/hidden data. */
export async function loadMenu(scope: "public" | "admin", db: Queryable | null = null) {
  const run = db ? db.query.bind(db) : q;
  const pub = scope === "public";
  const [cats, items, variants, groups, mods, links, defaults] = await Promise.all([
    run<MenuCategoryRow>(`select id, name, slug, description, art_kind, sort, is_active from menu_categories ${pub ? "where is_active" : ""} order by sort, name`),
    run<Omit<MenuItemRow, "variants" | "group_ids" | "default_modifier_ids">>(
      `select id, category_id, name, slug, description, price, cost_price, diet, tags, image_id,
              (select storage_path from images im where im.id = menu_items.image_id) as image_path, art_kind, tint, visual, status, is_active, is_featured, sort
         from menu_items ${pub ? "where is_active and status <> 'hidden'" : "where is_active"} order by sort, name`,
    ),
    run<MenuVariant & { item_id: string }>(`select id, item_id, name, price, cost_price, is_default, is_active, sort from item_variants ${pub ? "where is_active" : ""} order by sort, name`),
    run<Omit<MenuModifierGroup, "modifiers">>(`select id, name, description, selection, min_select, max_select, is_active, sort from modifier_groups ${pub ? "where is_active" : ""} order by sort, name`),
    run<MenuModifier & { group_id: string }>(`select id, group_id, name, price, visual_key, is_active, sort from modifiers ${pub ? "where is_active" : ""} order by sort, name`),
    run<{ item_id: string; group_id: string }>("select item_id, group_id from item_modifier_groups order by sort"),
    run<{ item_id: string; modifier_id: string }>("select item_id, modifier_id from item_default_modifiers"),
  ]);

  const modsByGroup = new Map<string, MenuModifier[]>();
  for (const m of mods.rows) {
    const { group_id, ...rest } = m;
    modsByGroup.set(group_id, [...(modsByGroup.get(group_id) ?? []), rest]);
  }
  const groupList: MenuModifierGroup[] = groups.rows.map((g) => ({ ...g, modifiers: modsByGroup.get(g.id) ?? [] }));
  const groupIds = new Set(groupList.map((g) => g.id));
  const variantsByItem = new Map<string, MenuVariant[]>();
  for (const v of variants.rows) {
    const { item_id, ...rest } = v;
    variantsByItem.set(item_id, [...(variantsByItem.get(item_id) ?? []), rest]);
  }
  const groupsByItem = new Map<string, string[]>();
  for (const l of links.rows) if (groupIds.has(l.group_id)) groupsByItem.set(l.item_id, [...(groupsByItem.get(l.item_id) ?? []), l.group_id]);
  const defaultsByItem = new Map<string, string[]>();
  for (const d of defaults.rows) defaultsByItem.set(d.item_id, [...(defaultsByItem.get(d.item_id) ?? []), d.modifier_id]);

  const catIds = new Set(cats.rows.map((c) => c.id));
  const itemList: MenuItemRow[] = items.rows
    .filter((i) => !pub || catIds.has(i.category_id))
    .map((i) => ({
      ...i,
      variants: variantsByItem.get(i.id) ?? [],
      group_ids: groupsByItem.get(i.id) ?? [],
      default_modifier_ids: defaultsByItem.get(i.id) ?? [],
    }));

  return { categories: cats.rows, items: itemList, groups: groupList };
}

export type LoadedMenu = Awaited<ReturnType<typeof loadMenu>>;

/** Shape sent to customers: no costs, image URLs resolved. */
export function publicMenuPayload(m: LoadedMenu) {
  return {
    categories: m.categories.map(({ id, name, slug, description, art_kind }) => ({ id, name, slug, description, art_kind })),
    groups: m.groups.map((g) => ({ ...g, modifiers: g.modifiers.map(({ id, name, price, visual_key }) => ({ id, name, price, visual_key })) })),
    items: m.items.map((i) => ({
      id: i.id,
      category_id: i.category_id,
      name: i.name,
      slug: i.slug,
      description: i.description,
      price: i.price,
      diet: i.diet,
      tags: i.tags,
      image: imageUrl(i.image_id, i.image_path),
      art_kind: i.art_kind,
      tint: i.tint,
      visual: i.visual,
      status: i.status,
      is_featured: i.is_featured,
      variants: i.variants.map(({ id, name, price, is_default }) => ({ id, name, price, is_default })),
      group_ids: i.group_ids,
      default_modifier_ids: i.default_modifier_ids,
    })),
  };
}

export type PublicMenu = ReturnType<typeof publicMenuPayload>;
