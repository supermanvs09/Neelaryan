import "server-only";
import { timingSafeEqual } from "node:crypto";
import { q } from "./db";
import { sha256 } from "./auth/session";

/** Proves the caller placed the order (device secret) or owns it (signed-in customer). */
export async function canAccessOrder(orderId: string, token: string | null, customerId: string | null) {
  const { rows } = await q<{ access_hash: string | null; customer_id: string | null }>("select access_hash, customer_id from orders where id = $1", [orderId]);
  const o = rows[0];
  if (!o) return false;
  if (customerId && o.customer_id === customerId) return true;
  if (!token || !o.access_hash) return false;
  const a = Buffer.from(sha256(token));
  const b = Buffer.from(o.access_hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

