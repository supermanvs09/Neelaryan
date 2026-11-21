import "server-only";
import type { Queryable } from "./db";
import type { Ctx } from "./http";

/**
 * Appends to the audit trail (the table itself rejects updates and deletes).
 * Call inside the same transaction as the change so both succeed or neither.
 */
export async function audit(
  db: Queryable,
  ctx: Pick<Ctx, "user" | "ip"> | null,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
  details: Record<string, unknown> = {},
) {
  await db.query(
    `insert into audit_logs (user_id, actor, action, entity, entity_id, summary, details, ip)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ctx?.user?.id ?? null, ctx?.user ? `${ctx.user.name} (${ctx.user.username})` : "System", action, entity, entityId, summary.slice(0, 300), JSON.stringify(details), ctx?.ip ?? null],
  );
}

/** Field-level diff for audit details: only what changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(after[k] ?? null);
    if (a !== b) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return out;
}
