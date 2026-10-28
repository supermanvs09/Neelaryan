import type { Order } from "@/store/types";
import { LOYALTY_TARGET } from "@/data/config";
import { dayKey } from "./format";

/**
 * Stamps are derived from orders (never stored separately), which makes the
 * rules impossible to game: one stamp per completed + paid order, at most one
 * per calendar day; failed payments and QR scans alone earn nothing.
 */
export function loyaltyFrom(orders: Order[], redeemed: number) {
  const eligible = orders
    .filter((o) => o.status === "COMPLETED" && o.payment.status === "PAID")
    .sort((a, b) => (a.completedAt ?? a.createdAt) - (b.completedAt ?? b.createdAt));
  const days = new Set<string>();
  const stamped: Order[] = [];
  for (const o of eligible) {
    const d = dayKey(o.completedAt ?? o.createdAt);
    if (days.has(d)) continue;
    days.add(d);
    stamped.push(o);
  }
  const total = stamped.length;
  const earnedRewards = Math.floor(total / LOYALTY_TARGET);
  const available = Math.max(0, earnedRewards - redeemed);
  const current = total - earnedRewards * LOYALTY_TARGET;
  return { total, current, available, redeemed, stamped: stamped.reverse(), toNext: LOYALTY_TARGET - current };
}
