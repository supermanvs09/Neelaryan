/**
 * Schema-driven configuration for the interactive bowl & shake builders.
 *
 * Product prices come from the menu PDF (see menu.ts). Add-on prices below are
 * taken from the supplied builder mockups (and the ₹30 ice-cream scoop from the
 * menu PDF). They are admin-managed values — confirm with the owner before launch.
 *
 * Nutrition values are rough estimates for standard portions and are always
 * labelled "estimated" in the UI.
 */

import type { MenuItem } from "./menu";

export type IngredientId =
  // oats bases
  | "regular-oats"
  | "extra-oats"
  | "oats-milk"
  // fruits
  | "banana"
  | "apple"
  | "strawberry"
  | "blueberry"
  | "pomegranate"
  | "kiwi"
  | "mango"
  // toppings
  | "peanut-butter"
  | "almonds"
  | "chia"
  | "raisins"
  | "pumpkin-seeds"
  | "cocoa-nibs"
  | "choco-sauce"
  | "dry-fruits"
  | "cinnamon"
  // protein
  | "no-protein"
  | "plant-protein"
  | "whey-protein"
  // extras
  | "honey"
  | "granola"
  | "icecream-scoop"
  // shake bases
  | "regular-milk"
  | "almond-milk"
  | "oat-milk"
  | "coconut-milk"
  // shake toppings
  | "choco-chips"
  // sweetness / ice (no visuals)
  | "sweet-less"
  | "sweet-regular"
  | "sweet-extra"
  | "ice-none"
  | "ice-less"
  | "ice-regular";

export interface Nutrition {
  kcal: number;
  protein: number;
  fibre: number;
}

export interface BuilderOption {
  id: IngredientId;
  label: string;
  price: number;
  nutrition?: Nutrition;
}

export interface BuilderGroup {
  id: string;
  label: string;
  mode: "single" | "multi";
  /** Max selections for multi groups. */
  max?: number;
  options: BuilderOption[];
}

export interface BuilderStep {
  id: string;
  title: string;
  hint: string;
  groups: BuilderGroup[];
}

export type BuilderKind = "oats" | "shake";

const n = (kcal: number, protein: number, fibre: number): Nutrition => ({ kcal, protein, fibre });

export const OATS_STEPS: BuilderStep[] = [
  {
    id: "base",
    title: "Choose your base",
    hint: "Every great bowl starts here",
    groups: [
      {
        id: "base",
        label: "Base",
        mode: "single",
        options: [
          { id: "regular-oats", label: "Regular Oats", price: 0, nutrition: n(150, 5, 4) },
          { id: "oats-milk", label: "Oats + Milk", price: 20, nutrition: n(212, 8, 4) },
          { id: "extra-oats", label: "Extra Oats", price: 30, nutrition: n(225, 7.5, 6) },
        ],
      },
    ],
  },
  {
    id: "fruits",
    title: "Add fruits",
    hint: "Select up to 3",
    groups: [
      {
        id: "fruits",
        label: "Fruits",
        mode: "multi",
        max: 3,
        options: [
          { id: "banana", label: "Banana", price: 0, nutrition: n(53, 0.6, 1.6) },
          { id: "apple", label: "Apple", price: 10, nutrition: n(31, 0.2, 1.4) },
          { id: "strawberry", label: "Strawberry", price: 15, nutrition: n(16, 0.3, 1) },
          { id: "blueberry", label: "Blueberry", price: 15, nutrition: n(17, 0.2, 0.7) },
          { id: "pomegranate", label: "Pomegranate", price: 15, nutrition: n(33, 0.7, 1.6) },
          { id: "kiwi", label: "Kiwi", price: 15, nutrition: n(24, 0.5, 1.2) },
          { id: "mango", label: "Mango", price: 15, nutrition: n(30, 0.4, 0.8) },
        ],
      },
    ],
  },
  {
    id: "toppings",
    title: "Add toppings",
    hint: "Select up to 4",
    groups: [
      {
        id: "toppings",
        label: "Toppings",
        mode: "multi",
        max: 4,
        options: [
          { id: "peanut-butter", label: "Peanut Butter", price: 25, nutrition: n(94, 4, 1) },
          { id: "almonds", label: "Almonds", price: 15, nutrition: n(58, 2.1, 1.2) },
          { id: "chia", label: "Chia Seeds", price: 10, nutrition: n(49, 1.7, 3.4) },
          { id: "raisins", label: "Raisins", price: 10, nutrition: n(30, 0.3, 0.4) },
          { id: "pumpkin-seeds", label: "Pumpkin Seeds", price: 10, nutrition: n(56, 3, 0.6) },
          { id: "cocoa-nibs", label: "Cocoa Nibs", price: 15, nutrition: n(57, 1, 3) },
          { id: "choco-sauce", label: "Chocolate", price: 15, nutrition: n(50, 0.3, 0.3) },
          { id: "dry-fruits", label: "Dry Fruit Mix", price: 20, nutrition: n(70, 1.8, 0.8) },
          { id: "cinnamon", label: "Cinnamon", price: 0, nutrition: n(2, 0, 0.4) },
        ],
      },
    ],
  },
  {
    id: "protein",
    title: "Add protein",
    hint: "Optional",
    groups: [
      {
        id: "protein",
        label: "Protein",
        mode: "single",
        options: [
          { id: "no-protein", label: "No Protein", price: 0, nutrition: n(0, 0, 0) },
          { id: "plant-protein", label: "Plant Protein", price: 30, nutrition: n(110, 20, 1) },
          { id: "whey-protein", label: "Whey Protein", price: 40, nutrition: n(120, 24, 0) },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: "Finishing touches",
    hint: "Select any",
    groups: [
      {
        id: "extras",
        label: "Extras",
        mode: "multi",
        options: [
          { id: "honey", label: "Honey", price: 10, nutrition: n(30, 0, 0) },
          { id: "granola", label: "Granola", price: 15, nutrition: n(90, 2, 1.4) },
          { id: "icecream-scoop", label: "Ice Cream Scoop", price: 30, nutrition: n(120, 2, 0) },
        ],
      },
    ],
  },
];

export const SHAKE_STEPS: BuilderStep[] = [
  {
    id: "base",
    title: "Choose your base",
    hint: "The milk that carries the flavour",
    groups: [
      {
        id: "base",
        label: "Base",
        mode: "single",
        options: [
          { id: "regular-milk", label: "Regular Milk", price: 0 },
          { id: "almond-milk", label: "Almond Milk", price: 20 },
          { id: "oat-milk", label: "Oat Milk", price: 20 },
          { id: "coconut-milk", label: "Coconut Milk", price: 30 },
        ],
      },
    ],
  },
  {
    id: "sweet",
    title: "Sweetness & ice",
    hint: "Make it just right",
    groups: [
      {
        id: "sweetness",
        label: "Sweetness",
        mode: "single",
        options: [
          { id: "sweet-less", label: "Less sweet", price: 0 },
          { id: "sweet-regular", label: "Regular", price: 0 },
          { id: "sweet-extra", label: "Extra sweet", price: 0 },
        ],
      },
      {
        id: "ice",
        label: "Ice",
        mode: "single",
        options: [
          { id: "ice-none", label: "No ice", price: 0 },
          { id: "ice-less", label: "Less ice", price: 0 },
          { id: "ice-regular", label: "Regular ice", price: 0 },
        ],
      },
    ],
  },
  {
    id: "toppings",
    title: "Add toppings",
    hint: "Select up to 4",
    groups: [
      {
        id: "toppings",
        label: "Toppings",
        mode: "multi",
        max: 4,
        options: [
          { id: "choco-chips", label: "Choco Chips", price: 15 },
          { id: "almonds", label: "Almonds", price: 15 },
          { id: "granola", label: "Granola", price: 15 },
          { id: "peanut-butter", label: "Peanut Butter", price: 20 },
        ],
      },
    ],
  },
  {
    id: "protein",
    title: "Add protein",
    hint: "Optional",
    groups: [
      {
        id: "protein",
        label: "Protein",
        mode: "single",
        options: [
          { id: "no-protein", label: "No Protein", price: 0 },
          { id: "plant-protein", label: "Plant Protein", price: 30 },
          { id: "whey-protein", label: "Whey Protein", price: 40 },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: "Make it indulgent",
    hint: "Ice cream scoop ₹30 extra",
    groups: [
      {
        id: "extras",
        label: "Extras",
        mode: "multi",
        options: [{ id: "icecream-scoop", label: "Ice Cream Scoop", price: 30 }],
      },
    ],
  },
];

/** groupId -> selected option ids */
export type Selection = Record<string, IngredientId[]>;

type Recipe = Selection;

const OATS_RECIPES: Record<string, Recipe> = {
  "banana-cinnamon-oats": { fruits: ["banana"], toppings: ["cinnamon"] },
  "apple-cinnamon-oats": { fruits: ["apple"], toppings: ["cinnamon"] },
  "pomegranate-oats": { fruits: ["pomegranate"] },
  "light-dry-fruit-oats": { toppings: ["dry-fruits"] },
  "banana-peanut-butter-oats": { fruits: ["banana"], toppings: ["peanut-butter"] },
  "banana-and-dry-fruit-oats": { fruits: ["banana"], toppings: ["dry-fruits"] },
  "chocolate-peanut-butter-oats": { toppings: ["choco-sauce", "peanut-butter"] },
  "dry-fruit-and-seeds-oats": { toppings: ["dry-fruits", "chia", "pumpkin-seeds"] },
  "plant-protein-oats": { protein: ["plant-protein"] },
  "whey-protein-oats": { protein: ["whey-protein"] },
};

const SHAKE_RECIPES: Record<string, Recipe> = {
  "banana-plant-protein-shake": { protein: ["plant-protein"] },
  "banana-whey-protein-shake": { protein: ["whey-protein"] },
};

const OATS_DEFAULTS: Selection = { base: ["regular-oats"], fruits: [], toppings: [], protein: ["no-protein"], extras: [] };
const SHAKE_DEFAULTS: Selection = {
  base: ["regular-milk"],
  sweetness: ["sweet-regular"],
  ice: ["ice-regular"],
  toppings: [],
  protein: ["no-protein"],
  extras: [],
};

export function builderKindFor(item: MenuItem): BuilderKind | null {
  if (item.customizer === "oats-builder") return "oats";
  if (item.customizer === "shake-builder") return "shake";
  return null;
}

export function stepsFor(kind: BuilderKind) {
  return kind === "oats" ? OATS_STEPS : SHAKE_STEPS;
}

/** The recipe a menu item ships with: defaults merged with the item's own ingredients. */
export function recipeFor(kind: BuilderKind, itemId: string): Selection {
  const defaults = kind === "oats" ? OATS_DEFAULTS : SHAKE_DEFAULTS;
  const own = (kind === "oats" ? OATS_RECIPES : SHAKE_RECIPES)[itemId] ?? {};
  return { ...structuredClone(defaults), ...structuredClone(own) };
}

function allGroups(kind: BuilderKind) {
  return stepsFor(kind).flatMap((s) => s.groups);
}

export function optionById(kind: BuilderKind, id: IngredientId) {
  for (const g of allGroups(kind)) {
    const o = g.options.find((x) => x.id === id);
    if (o) return o;
  }
  return undefined;
}

/**
 * Price of the selection on top of the menu price.
 * - multi groups: every option not in the original recipe costs its add-on price
 * - single groups: pay the difference vs the recipe's choice (never negative)
 * Removing recipe ingredients never lowers the menu price.
 */
export function extrasPrice(kind: BuilderKind, recipe: Selection, sel: Selection) {
  let total = 0;
  for (const g of allGroups(kind)) {
    const chosen = sel[g.id] ?? [];
    const included = recipe[g.id] ?? [];
    if (g.mode === "multi") {
      for (const id of chosen) {
        if (!included.includes(id)) total += g.options.find((o) => o.id === id)?.price ?? 0;
      }
    } else {
      const now = g.options.find((o) => o.id === chosen[0])?.price ?? 0;
      const was = g.options.find((o) => o.id === included[0])?.price ?? 0;
      total += Math.max(0, now - was);
    }
  }
  return total;
}

/** Add-on price for a single option relative to the recipe (for option chips). */
export function optionDelta(kind: BuilderKind, recipe: Selection, group: BuilderGroup, opt: BuilderOption) {
  const included = recipe[group.id] ?? [];
  if (group.mode === "multi") return included.includes(opt.id) ? 0 : opt.price;
  const was = group.options.find((o) => o.id === included[0])?.price ?? 0;
  return Math.max(0, opt.price - was);
}

export function estimateNutrition(kind: BuilderKind, sel: Selection): Nutrition | null {
  if (kind !== "oats") return null;
  const total = { kcal: 0, protein: 0, fibre: 0 };
  for (const g of allGroups(kind)) {
    for (const id of sel[g.id] ?? []) {
      const nn = g.options.find((o) => o.id === id)?.nutrition;
      if (nn) {
        total.kcal += nn.kcal;
        total.protein += nn.protein;
        total.fibre += nn.fibre;
      }
    }
  }
  return { kcal: Math.round(total.kcal / 5) * 5, protein: Math.round(total.protein), fibre: Math.round(total.fibre) };
}

/** Human readable summary lines grouped by step, e.g. "Fruits: Banana, Kiwi". */
export function describeSelection(kind: BuilderKind, recipe: Selection, sel: Selection) {
  const lines: { label: string; value: string }[] = [];
  for (const g of allGroups(kind)) {
    const chosen = sel[g.id] ?? [];
    const included = recipe[g.id] ?? [];
    const labels = chosen.map((id) => g.options.find((o) => o.id === id)?.label ?? id);
    const removed = included.filter((id) => !chosen.includes(id));
    if (g.mode === "single") {
      lines.push({ label: g.label, value: labels[0] ?? "—" });
    } else {
      const parts: string[] = [];
      if (labels.length) parts.push(labels.join(", "));
      if (removed.length)
        parts.push(`no ${removed.map((id) => g.options.find((o) => o.id === id)?.label ?? id).join(", ")}`);
      if (parts.length) lines.push({ label: g.label, value: parts.join(" · ") });
    }
  }
  return lines;
}

/** Validates a selection against the schema (used when restoring from storage). */
export function sanitizeSelection(kind: BuilderKind, recipe: Selection, sel: Selection): Selection {
  const out: Selection = {};
  for (const g of allGroups(kind)) {
    const valid = (sel[g.id] ?? []).filter((id) => g.options.some((o) => o.id === id));
    if (g.mode === "single") out[g.id] = valid.length ? [valid[0]] : [...(recipe[g.id] ?? [g.options[0].id])];
    else out[g.id] = Array.from(new Set(valid)).slice(0, g.max ?? g.options.length);
  }
  return out;
}

/** Per-shake garnish & liquid used by the 3D glass. */
export type Garnish =
  | "none"
  | "choco-drizzle"
  | "caramel-drizzle"
  | "pb-drizzle"
  | "banana"
  | "dates"
  | "coffee-beans"
  | "oreo"
  | "saffron-almond"
  | "kitkat"
  | "pista";

export const SHAKE_GARNISH: Record<string, Garnish> = {
  "vanilla-milkshake": "none",
  "chocolate-milkshake": "choco-drizzle",
  "peanut-butter-and-milkmaid-shake": "pb-drizzle",
  "banana-smoothie": "banana",
  "dates-shake": "dates",
  "butterscotch-shake": "caramel-drizzle",
  "cold-coffee-and-chocolate-shake": "coffee-beans",
  "oreo-milkshake": "oreo",
  "kesar-badam-shake": "saffron-almond",
  "chocolate-peanut-butter-shake": "choco-drizzle",
  "kitkat-shake": "kitkat",
  "pista-shake": "pista",
  "banana-plant-protein-shake": "banana",
  "banana-whey-protein-shake": "banana",
};
