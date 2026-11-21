import "server-only";
import type { NextRequest } from "next/server";
import { q } from "../db";
import { newToken, sha256 } from "../auth/session";

export const CUSTOMER_COOKIE = "nr_customer";
export const CUSTOMER_SESSION_DAYS = 90;

export interface SessionCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  sessionId: string;
}

export async function createCustomerSession(customerId: string) {
  const token = newToken();
  await q(`insert into customer_sessions (id, customer_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`, [
    sha256(token),
    customerId,
    CUSTOMER_SESSION_DAYS,
  ]);
  return token;
}

export async function customerFromToken(token: string | undefined | null): Promise<SessionCustomer | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const { rows } = await q<{ id: string; name: string; phone: string | null; email: string | null }>(
    `select c.id, c.name, c.phone, c.email from customer_sessions s join customers c on c.id = s.customer_id
      where s.id = $1 and s.expires_at > now() and c.is_active`,
    [id],
  );
  return rows[0] ? { ...rows[0], sessionId: id } : null;
}

export const customerFromRequest = (req: NextRequest) => customerFromToken(req.cookies.get(CUSTOMER_COOKIE)?.value);
