import { z } from "zod";
import { api, csv, searchParams } from "@/server/http";
import { q } from "@/server/db";

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  user: z.string().uuid().optional(),
  entity: z.string().max(40).optional(),
  q: z.string().trim().max(80).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

/** The append-only audit trail (the database rejects edits and deletes to it). */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [f.from, f.to];
    const where = [`(a.at at time zone 'Asia/Kolkata')::date between $1 and $2`];
    if (f.user) where.push(`a.user_id = $${params.push(f.user)}`);
    if (f.entity) where.push(`a.entity = $${params.push(f.entity)}`);
    if (f.q) where.push(`(a.summary ilike $${params.push(`%${f.q}%`)} or a.actor ilike $${params.length})`);
    const [rows, users, entities] = await Promise.all([
      q<{ id: number; at: string; actor: string; action: string; entity: string; entity_id: string | null; summary: string; details: Record<string, unknown>; ip: string | null }>(
        `select a.id, a.at, a.actor, a.action, a.entity, a.entity_id, a.summary, a.details, a.ip from audit_logs a
          where ${where.join(" and ")} order by a.at desc, a.id desc limit ${f.format === "csv" ? 20000 : 500}`,
        params,
      ),
      q("select id, name, username from users order by lower(name)"),
      q<{ entity: string }>("select distinct entity from audit_logs order by entity"),
    ]);
    if (f.format === "csv") {
      return csv(`audit-log-${f.from}-to-${f.to}.csv`, [
        ["When", "Who", "Action", "Record", "Record id", "Summary", "Details", "IP"],
        ...rows.rows.map((r) => [new Date(r.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), r.actor, r.action, r.entity, r.entity_id ?? "", r.summary, JSON.stringify(r.details), r.ip ?? ""]),
      ]);
    }
    return { entries: rows.rows, users: users.rows, entities: entities.rows.map((e) => e.entity) };
  },
  { permission: "audit.view" },
);
