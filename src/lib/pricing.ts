import { bestOffer, cafeClock, discountFor, type Offer } from "./offers";

/**
 * Order pricing — shared by the customer app (to show prices) and the server
 * (which is the authority). Rules:
 *  - base price = chosen variant's price, else the item price
 *  - multi-select modifiers: each one not included in the item's recipe costs its price
 *  - single-select modifiers: pay the difference vs the item's default (never negative)
 *  - removing an included ingredient never lowers the price
 */

export interface PricingModifier {
  id: string;
  name: string;
  price: number;
}
export interface PricingGroup {
  id: string;
  name: string;
  selection: "single" | "multi";
  min_select: number;
  max_select: number | null;
  modifiers: PricingModifier[];
}
export interface PricingItem {
  id: string;
  name: string;
  price: number;
  status: string;
  variants: { id: string; name: string; price: number; is_default: boolean }[];
  group_ids: string[];
  default_modifier_ids: string[];
}
export interface PricingMenu {
  items: PricingItem[];
  groups: PricingGroup[];
  /** active offers; only those live at `at` apply */
  offers?: Offer[];
}

export interface LineInput {
  item_id: string;
  variant_id?: string | null;
  modifier_ids?: string[];
  qty: number;
}

export interface ChosenModifier {
  id: string;
  name: string;
  group: string;
  price: number;
}

export type PricedLine =
  | {
      ok: true;
      item: PricingItem;
      name: string;
      variant: { id: string; name: string } | null;
      modifiers: ChosenModifier[];
      /** Included ingredients the guest removed (shown to the kitchen as "no …"). */
      removed: string[];
      modifierIds: string[];
      unitPrice: number;
      lineTotal: number;
      /** per-unit offer discount on the base price (already taken off unitPrice) */
      discount: number;
      offer: { id: string; title: string; percent_off: number } | null;
      /** base (size) price before the offer */
      basePrice: number;
    }
  | { ok: false; error: string };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function priceLine(menu: PricingMenu, line: LineInput, at: Date = new Date()): PricedLine {
  const item = menu.items.find((i) => i.id === line.item_id);
  if (!item) return { ok: false, error: "This item is no longer on the menu." };
  if (item.status !== "available") return { ok: false, error: `${item.name} is sold out right now.` };
  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) return { ok: false, error: "Quantity must be between 1 and 50." };

  let base = item.price;
  let variant: { id: string; name: string } | null = null;
  if (item.variants.length) {
    const v = line.variant_id ? item.variants.find((x) => x.id === line.variant_id) : item.variants.find((x) => x.is_default) ?? item.variants[0];
    if (!v) return { ok: false, error: `Choose a size for ${item.name}.` };
    base = v.price;
    variant = { id: v.id, name: v.name };
  } else if (line.variant_id) {
    return { ok: false, error: `${item.name} has no size options.` };
  }

  const groups = item.group_ids.map((id) => menu.groups.find((g) => g.id === id)).filter((g): g is PricingGroup => !!g);
  const wanted = new Set(line.modifier_ids ?? []);
  const known = new Set(groups.flatMap((g) => g.modifiers.map((m) => m.id)));
  for (const id of wanted) if (!known.has(id)) return { ok: false, error: `An option for ${item.name} is no longer available.` };

  const defaults = new Set(item.default_modifier_ids);
  const chosen: ChosenModifier[] = [];
  const removed: string[] = [];
  let extra = 0;

  for (const g of groups) {
    const inGroup = g.modifiers.filter((m) => wanted.has(m.id));
    const groupDefaults = g.modifiers.filter((m) => defaults.has(m.id));
    if (g.selection === "single") {
      let pick = inGroup;
      if (!pick.length && groupDefaults.length) pick = [groupDefaults[0]];
      if (pick.length > 1) return { ok: false, error: `Choose one ${g.name.toLowerCase()} for ${item.name}.` };
      if (pick.length < Math.min(1, g.min_select)) return { ok: false, error: `Choose a ${g.name.toLowerCase()} for ${item.name}.` };
      if (pick[0]) {
        const def = groupDefaults[0]?.price ?? 0;
        const delta = Math.max(0, pick[0].price - def);
        extra += delta;
        chosen.push({ id: pick[0].id, name: pick[0].name, group: g.name, price: delta });
      }
    } else {
      if (g.max_select !== null && inGroup.length > g.max_select) return { ok: false, error: `Pick up to ${g.max_select} ${g.name.toLowerCase()} for ${item.name}.` };
      if (inGroup.length < g.min_select) return { ok: false, error: `Pick at least ${g.min_select} ${g.name.toLowerCase()} for ${item.name}.` };
      for (const m of inGroup) {
        const delta = defaults.has(m.id) ? 0 : m.price;
        extra += delta;
        chosen.push({ id: m.id, name: m.name, group: g.name, price: delta });
      }
      for (const d of groupDefaults) if (!wanted.has(d.id)) removed.push(d.name);
    }
  }

  // offers come off the base price only (never add-ons), rounded down to whole rupees
  const offer = menu.offers?.length ? bestOffer(item.id, menu.offers, cafeClock(at)) : null;
  const discount = offer ? discountFor(base, offer.percent_off) : 0;
  const unitPrice = round2(base - discount + extra);
  return {
    ok: true,
    item,
    name: item.name,
    variant,
    modifiers: chosen,
    removed,
    modifierIds: chosen.map((c) => c.id).sort(),
    unitPrice,
    lineTotal: round2(unitPrice * line.qty),
    discount,
    offer: offer && discount > 0 ? { id: offer.id, title: offer.title, percent_off: offer.percent_off } : null,
    basePrice: base,
  };
}

export interface TaxConfig {
  gst_percent: number;
  service_charge_percent: number;
}

/** Bill totals. GST applies to the discounted amount plus service charge. */
export function billTotals(subtotal: number, discount: number, tax: TaxConfig) {
  const d = Math.min(round2(discount), round2(subtotal));
  const net = round2(subtotal - d);
  const service = round2((net * tax.service_charge_percent) / 100);
  const gst = round2(((net + service) * tax.gst_percent) / 100);
  return { subtotal: round2(subtotal), discount: d, service_charge: service, tax: gst, total: round2(net + service + gst) };
}
