/**
 * Pure calculations behind the shopping list, the usage check and menu insights.
 * Quantities are in each item's base unit (g, ml, pcs, packet).
 */

export const USAGE_WINDOW_DAYS = 14;

export interface StockItem {
  id: string;
  name: string;
  base_unit: string;
  display_unit: string;
  stock_qty: number;
  min_qty: number;
  avg_cost: number | null;
  supplier: string | null;
}

export interface Usage {
  item_id: string;
  /** consumed by orders (net of cancellations) */
  sold: number;
  /** logged as used / corrections out (positive) */
  used: number;
  wasted: number;
  /** sum of count differences (negative = less found than expected) */
  count_difference: number;
  counts: number;
  first_movement_at: string | null;
}

/** Average use per day over the window (or since the item's first movement). */
export function dailyUse(u: Usage | undefined, now = Date.now(), windowDays = USAGE_WINDOW_DAYS) {
  if (!u) return 0;
  const consumed = u.sold + u.used + u.wasted;
  if (consumed <= 0) return 0;
  const since = u.first_movement_at ? (now - new Date(u.first_movement_at).getTime()) / 86400000 : windowDays;
  return consumed / Math.min(windowDays, Math.max(1, since));
}

/** Round up to what you'd actually buy in that unit. */
export function roundPurchase(baseQty: number, display: string) {
  if (baseQty <= 0) return 0;
  const step = display === "kg" || display === "L" ? 500 : display === "g" || display === "ml" ? (baseQty >= 1000 ? 250 : 50) : display === "dozen" ? 12 : 1;
  return Math.ceil(baseQty / step - 1e-9) * step;
}

export interface ShoppingRow {
  item: StockItem;
  perDay: number;
  daysLeft: number | null;
  buy: number;
  estimatedCost: number | null;
  reason: "below_min" | "runs_out";
}

/**
 * What to buy so stock lasts `coverDays` and still ends at the minimum level.
 * Items with no usage yet are listed only when already at or below their minimum.
 */
export function shoppingList(items: StockItem[], usage: Usage[], coverDays: number, now = Date.now()): ShoppingRow[] {
  const byId = new Map(usage.map((u) => [u.item_id, u]));
  const rows: ShoppingRow[] = [];
  for (const it of items) {
    const perDay = dailyUse(byId.get(it.id), now);
    const onHand = Math.max(0, it.stock_qty);
    const target = perDay > 0 ? perDay * coverDays + it.min_qty : it.min_qty > 0 ? it.min_qty * 2 : 0;
    if (target <= onHand) continue;
    const buy = roundPurchase(target - onHand, it.display_unit);
    if (buy <= 0) continue;
    rows.push({
      item: it,
      perDay,
      daysLeft: perDay > 0 ? onHand / perDay : null,
      buy,
      estimatedCost: it.avg_cost === null ? null : Math.round(buy * it.avg_cost),
      reason: it.min_qty > 0 && it.stock_qty <= it.min_qty ? "below_min" : "runs_out",
    });
  }
  return rows.sort((a, b) => (a.daysLeft ?? -1) - (b.daysLeft ?? -1) || a.item.name.localeCompare(b.item.name));
}

export interface UsageRow {
  item: StockItem;
  expected: number;
  actual: number;
  /** positive = more went missing than recorded */
  gap: number;
  gapPct: number | null;
  gapValue: number | null;
  counted: boolean;
  status: "ok" | "watch" | "high" | "surplus" | "not_counted";
}

/** Expected use (orders, logged use, waste) vs what stock counts revealed. */
export function usageCheck(items: StockItem[], usage: Usage[]): UsageRow[] {
  const byId = new Map(usage.map((u) => [u.item_id, u]));
  return items
    .map((it) => {
      const u = byId.get(it.id);
      const expected = u ? u.sold + u.used + u.wasted : 0;
      const gap = u ? -u.count_difference : 0;
      const counted = !!u && u.counts > 0;
      const gapPct = expected > 0 ? gap / expected : null;
      let status: UsageRow["status"] = "not_counted";
      if (counted) {
        if (gap < 0) status = Math.abs(gapPct ?? 1) > 0.05 ? "surplus" : "ok";
        else if (gapPct === null) status = gap > 0 ? "high" : "ok";
        else status = gapPct > 0.15 ? "high" : gapPct > 0.05 ? "watch" : "ok";
      }
      return { item: it, expected, actual: expected + gap, gap, gapPct, gapValue: it.avg_cost === null ? null : Math.round(gap * it.avg_cost), counted, status };
    })
    .filter((r) => r.expected > 0 || r.counted)
    .sort((a, b) => (b.gapValue ?? 0) - (a.gapValue ?? 0) || a.item.name.localeCompare(b.item.name));
}

/* ── Menu engineering (Kasavana & Smith) ─────────────────────────────────── */

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog" | "unknown";

export const CLASS_INFO: Record<MenuClass, { label: string; hint: string; action: string }> = {
  star: { label: "Stars", hint: "Popular and profitable", action: "Keep them exactly as they are. Show them first and never let them run out." },
  plowhorse: { label: "Popular, low profit", hint: "Sell a lot, earn little each", action: "Raise the price a little (₹5–10) or make them cheaper to prepare. A combo with a high-profit drink also helps." },
  puzzle: { label: "Profitable, rarely ordered", hint: "Earn well, but few people order", action: "Promote them: feature them, add a good photo, run an offer, or suggest them at the counter." },
  dog: { label: "Weak sellers", hint: "Few orders and little profit", action: "Replace them, rework the recipe, or remove them to keep the menu short." },
  unknown: { label: "Cost not set", hint: "Add a recipe or cost to analyse", action: "Add a recipe (Menu → item → Recipe) or a cost price to see where it belongs." },
};

export interface SoldItem {
  menu_item_id: string | null;
  name: string;
  qty: number;
  sales: number;
  /** null when any sold line had no cost */
  cost: number | null;
}

export interface InsightRow {
  menu_item_id: string | null;
  name: string;
  qty: number;
  sales: number;
  profit: number | null;
  marginPerUnit: number | null;
  marginPct: number | null;
  mix: number;
  klass: MenuClass;
}

/**
 * Popularity: an item is popular when it sells at least 70 % of an equal share of units.
 * Profitability: its profit per unit vs the menu's average profit per unit.
 * `unsold` are menu items with no sales in the period (cost per unit known or not).
 */
export function menuEngineering(sold: SoldItem[], unsold: { menu_item_id: string; name: string; price: number; unitCost: number | null }[]) {
  const rows: Omit<InsightRow, "mix" | "klass">[] = sold.map((s) => {
    const profit = s.cost === null ? null : s.sales - s.cost;
    return { menu_item_id: s.menu_item_id, name: s.name, qty: s.qty, sales: s.sales, profit, marginPerUnit: profit === null || !s.qty ? null : profit / s.qty, marginPct: profit === null || !s.sales ? null : profit / s.sales };
  });
  for (const u of unsold)
    rows.push({ menu_item_id: u.menu_item_id, name: u.name, qty: 0, sales: 0, profit: u.unitCost === null ? null : 0, marginPerUnit: u.unitCost === null ? null : u.price - u.unitCost, marginPct: u.unitCost === null || !u.price ? null : (u.price - u.unitCost) / u.price });
  const totalUnits = rows.reduce((n, r) => n + r.qty, 0);
  const popularAt = rows.length ? (totalUnits / rows.length) * 0.7 : 0;
  const costed = rows.filter((r) => r.profit !== null && r.qty > 0);
  const costedUnits = costed.reduce((n, r) => n + r.qty, 0);
  const averageMargin = costedUnits ? costed.reduce((n, r) => n + (r.profit as number), 0) / costedUnits : null;
  return {
    totalUnits,
    popularAt,
    averageMargin,
    rows: rows
      .map((r) => {
        const popular = r.qty > 0 && r.qty >= popularAt;
        let klass: MenuClass = "unknown";
        if (r.marginPerUnit !== null && averageMargin !== null) {
          const high = r.marginPerUnit >= averageMargin;
          klass = popular ? (high ? "star" : "plowhorse") : high ? "puzzle" : "dog";
        }
        return { ...r, klass, mix: totalUnits ? r.qty / totalUnits : 0 };
      })
      .sort((a, b) => b.qty - a.qty || b.sales - a.sales || a.name.localeCompare(b.name)),
  };
}

/* ── Pickup slots for pre-orders (15 min, from 20 min out, last 10:45 pm) ── */
export function pickupSlots(now = new Date(), clockMinutes: number, isoDate: string, max = 32) {
  const start = Math.ceil((clockMinutes + 20) / 15) * 15;
  const midnight = new Date(`${isoDate}T00:00:00+05:30`).getTime();
  const out: { iso: string; label: string }[] = [];
  for (let m = start; m <= 22 * 60 + 45 && out.length < max; m += 15) {
    const at = new Date(midnight + m * 60000);
    out.push({ iso: at.toISOString(), label: at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) });
  }
  void now;
  return out;
}
