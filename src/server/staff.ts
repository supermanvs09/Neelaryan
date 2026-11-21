import "server-only";
import { randomInt } from "node:crypto";
import { conflict, type Ctx } from "./http";
import type { Queryable } from "./db";
import { SUPER_ADMIN } from "./auth/permissions";

const WORDS = ["Mango", "Cocoa", "Masala", "Elaichi", "Jaggery", "Saffron", "Tulsi", "Kesar", "Badam", "Pista", "Chai", "Filter", "Ragi", "Kokum", "Jamun", "Lassi"];

/** A temporary password that passes the policy and is easy to read aloud; shown to the admin once. */
export function temporaryPassword() {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${randomInt(1000, 9999)}`;
}

/** Refuses changes that would leave nobody able to manage staff. */
export async function assertSuperAdminRemains(db: Queryable, change: { userId: string; newRole?: string; active?: boolean }) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from users where is_active and role_key = $1 and id <> $2`,
    [SUPER_ADMIN, change.userId],
  );
  const target = await db.query<{ role_key: string; is_active: boolean }>("select role_key, is_active from users where id = $1", [change.userId]);
  const wasSuper = target.rows[0]?.role_key === SUPER_ADMIN && target.rows[0]?.is_active;
  const staysSuper = (change.newRole ?? target.rows[0]?.role_key) === SUPER_ADMIN && (change.active ?? target.rows[0]?.is_active);
  if (wasSuper && !staysSuper && rows[0].n === 0) throw conflict("There must always be at least one active Super Admin.");
}

export function selfGuard(ctx: Ctx, userId: string, change: { role?: string; active?: boolean }) {
  if (ctx.user?.id !== userId) return;
  if (change.active === false) throw conflict("You can't deactivate your own account.");
  if (change.role && change.role !== ctx.user.role) throw conflict("You can't change your own role. Ask another Super Admin.");
}
