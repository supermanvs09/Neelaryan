import { randomBytes } from "node:crypto";
import type { Queryable } from "./index";
import { DEFAULT_ROLES } from "../auth/permissions";
import { hashPassword } from "../auth/password";
import { CATEGORIES, MENU } from "@/data/menu";
import { OATS_STEPS, SHAKE_STEPS, recipeFor, type BuilderKind } from "@/data/builders";
import { SIMPLE_GROUPS, type SimpleGroup } from "@/data/config";

/**
 * Idempotent first-run data. Imports the existing NEELARYAN menu (names and
 * prices from the menu PDF), its customisers, tables and sensible defaults.
 * No fake orders, stock or money — dashboards only ever show real data.
 */
const SEED_VERSION = 1;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  business: {
    name: "NEELARYAN Café",
    tagline: "Crave the goodness.",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    timezone: "Asia/Kolkata",
  },
  tax: { gst_percent: 5, service_charge_percent: 0 },
  ordering: { accepting_orders: true, takeaway_enabled: true, closed_message: "We're not taking orders right now. Please check back soon.", preorders_enabled: true, show_wait_time: true },
  payments: { cash_enabled: true, upi_enabled: false, upi_id: "", upi_payee_name: "NEELARYAN Café" },
  kitchen: { link_enabled: false, link_token: "" },
  loyalty: {
    enabled: true,
    points_per_100: 5,
    min_order_amount: 100,
    point_value: 0.25,
    min_redeem_points: 100,
    max_redeem_percent: 50,
    expiry_months: 12,
    welcome_bonus: 0,
    promo_multiplier: 1,
    promo_from: null,
    promo_to: null,
  },
  notifications: { birthday_enabled: false, birthday_template_ids: [], send_hour: 10 },
};

export const EXPENSE_CATEGORIES = [
  "Staff wages",
  "Rent",
  "Electricity & water",
  "Gas & fuel",
  "Packaging & disposables",
  "Repairs & maintenance",
  "Marketing",
  "Bank & payment charges",
  "Licences & taxes",
  "Other",
];

const INVENTORY_CATEGORIES = ["Dairy", "Fruits & vegetables", "Dry goods & grains", "Nuts & seeds", "Beverages & syrups", "Bakery", "Meat & eggs", "Packaging", "Retail products"];

export const newQrToken = () => randomBytes(12).toString("base64url");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function seed(q: Queryable) {
  const { rows } = await q.query<{ value: number }>("select value from settings where key = 'seed_version'");
  if (rows[0] && Number(rows[0].value) >= SEED_VERSION) return;

  // roles
  for (const r of DEFAULT_ROLES) {
    await q.query(
      `insert into roles (key, name, description, permissions, is_system) values ($1,$2,$3,$4,$5)
       on conflict (key) do nothing`,
      [r.key, r.name, r.description, r.permissions, r.is_system],
    );
  }

  // initial administrator — must change the password on first sign-in
  const users = await q.query("select 1 from users limit 1");
  if (!users.rows.length) {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim() || "admin";
    const password = process.env.INITIAL_ADMIN_PASSWORD || "welcome@2026";
    await q.query(
      `insert into users (username, name, role_key, password_hash, must_change_password) values ($1, 'Administrator', 'super_admin', $2, true)`,
      [username, await hashPassword(password)],
    );
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await q.query("insert into settings (key, value) values ($1, $2) on conflict (key) do nothing", [key, JSON.stringify(value)]);
  }

  for (const [i, name] of EXPENSE_CATEGORIES.entries()) {
    await q.query("insert into expense_categories (name, sort) values ($1, $2) on conflict do nothing", [name, i]);
  }
  for (const [i, name] of INVENTORY_CATEGORIES.entries()) {
    await q.query("insert into inventory_categories (name, sort) values ($1, $2) on conflict do nothing", [name, i]);
  }

  const tables = await q.query("select 1 from dining_tables limit 1");
  if (!tables.rows.length) {
    for (let i = 1; i <= 16; i++) {
      await q.query("insert into dining_tables (label, seats, sort, qr_token) values ($1, 4, $2, $3)", [String(i).padStart(2, "0"), i, newQrToken()]);
    }
  }

  const menu = await q.query("select 1 from menu_items limit 1");
  if (!menu.rows.length) await seedMenu(q);

  await seedTemplates(q);

  await q.query(
    "insert into settings (key, value) values ('seed_version', $1) on conflict (key) do update set value = excluded.value",
    [JSON.stringify(SEED_VERSION)],
  );
}

async function insertGroup(q: Queryable, name: string, selection: "single" | "multi", min: number, max: number | null, sort: number) {
  const { rows } = await q.query<{ id: string }>(
    "insert into modifier_groups (name, selection, min_select, max_select, sort) values ($1,$2,$3,$4,$5) returning id",
    [name, selection, min, max, sort],
  );
  return rows[0].id;
}

async function seedMenu(q: Queryable) {
  const catIds = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const { rows } = await q.query<{ id: string }>(
      "insert into menu_categories (name, slug, description, art_kind, sort) values ($1,$2,$3,$4,$5) returning id",
      [c.name, c.id, c.blurb ?? "", c.art, i],
    );
    catIds.set(c.id, rows[0].id);
  }

  // builder groups (oats bowls, milkshakes): one shared set per builder kind
  const builderGroups: Record<BuilderKind, { groupId: string; stepGroupId: string; options: Map<string, string> }[]> = { oats: [], shake: [] };
  let sort = 0;
  for (const [kind, steps, label] of [
    ["oats", OATS_STEPS, "Oats bowl"],
    ["shake", SHAKE_STEPS, "Milkshake"],
  ] as const) {
    for (const step of steps) {
      for (const g of step.groups) {
        const single = g.mode === "single";
        const groupId = await insertGroup(q, `${label} — ${g.label}`, g.mode, single ? 1 : 0, single ? 1 : g.max ?? null, sort++);
        const options = new Map<string, string>();
        for (const [j, o] of g.options.entries()) {
          const { rows } = await q.query<{ id: string }>(
            "insert into modifiers (group_id, name, price, visual_key, sort) values ($1,$2,$3,$4,$5) returning id",
            [groupId, o.label, o.price, o.id, j],
          );
          options.set(o.id, rows[0].id);
        }
        builderGroups[kind].push({ groupId, stepGroupId: g.id, options });
      }
    }
  }

  // simple choice groups (sugar, ice, spice…), shared by many items
  const simpleIds = new Map<string, { groupId: string; options: string[] }>();
  const simpleGroup = async (g: SimpleGroup) => {
    const existing = simpleIds.get(g.id);
    if (existing) return existing;
    const groupId = await insertGroup(q, g.label, "single", 1, 1, sort++);
    const options: string[] = [];
    for (const [j, name] of g.options.entries()) {
      const { rows } = await q.query<{ id: string }>("insert into modifiers (group_id, name, price, sort) values ($1,$2,0,$3) returning id", [groupId, name, j]);
      options.push(rows[0].id);
    }
    const v = { groupId, options };
    simpleIds.set(g.id, v);
    return v;
  };

  for (const [i, m] of MENU.entries()) {
    const visual = m.customizer === "oats-builder" ? "bowl" : m.customizer === "shake-builder" ? "glass" : "art";
    const { rows } = await q.query<{ id: string }>(
      `insert into menu_items (category_id, name, slug, description, price, diet, tags, art_kind, tint, visual, is_featured, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [catIds.get(m.category), m.name, m.id || slug(m.name), m.description, m.price, m.diet, m.tags, m.art, m.tint, visual, m.tags.includes("bestseller"), i],
    );
    const itemId = rows[0].id;

    if (m.customizer === "oats-builder" || m.customizer === "shake-builder") {
      const kind: BuilderKind = m.customizer === "oats-builder" ? "oats" : "shake";
      const recipe = recipeFor(kind, m.id);
      for (const [k, g] of builderGroups[kind].entries()) {
        await q.query("insert into item_modifier_groups (item_id, group_id, sort) values ($1,$2,$3)", [itemId, g.groupId, k]);
        for (const optId of recipe[g.stepGroupId] ?? []) {
          const modId = g.options.get(optId);
          if (modId) await q.query("insert into item_default_modifiers (item_id, modifier_id) values ($1,$2) on conflict do nothing", [itemId, modId]);
        }
      }
    } else {
      for (const [k, sg] of SIMPLE_GROUPS[m.customizer].entries()) {
        const g = await simpleGroup(sg);
        await q.query("insert into item_modifier_groups (item_id, group_id, sort) values ($1,$2,$3)", [itemId, g.groupId, k]);
        await q.query("insert into item_default_modifiers (item_id, modifier_id) values ($1,$2)", [itemId, g.options[sg.defaultIndex]]);
      }
    }
  }
}

async function seedTemplates(q: Queryable) {
  const has = await q.query("select 1 from notification_templates limit 1");
  if (has.rows.length) return;
  const t = [
    {
      name: "Birthday wishes (email)",
      channel: "email",
      kind: "birthday",
      subject: "Happy Birthday, {{first_name}}! 🎂",
      body: "Happy Birthday, {{first_name}}! NEELARYAN wishes you a wonderful year ahead. We have a special gift waiting for you — show this message at the café this week.\n\nWith warmth,\nNEELARYAN Café",
    },
    {
      name: "Birthday wishes (SMS)",
      channel: "sms",
      kind: "birthday",
      subject: "",
      body: "Happy Birthday, {{first_name}}! NEELARYAN wishes you a wonderful year ahead. A special gift is waiting for you at the café.",
    },
    {
      name: "Seasonal offer (email)",
      channel: "email",
      kind: "promotion",
      subject: "Something new at NEELARYAN, {{first_name}}",
      body: "Hi {{first_name}},\n\nWe've got something special on the menu this week. Drop by and treat yourself — you have {{points}} points waiting.\n\nNEELARYAN Café",
    },
  ];
  for (const x of t) {
    await q.query("insert into notification_templates (name, channel, kind, subject, body) values ($1,$2,$3,$4,$5)", [x.name, x.channel, x.kind, x.subject, x.body]);
  }
}
