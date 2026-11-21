import { z } from "zod";
import { api, notFound } from "@/server/http";
import { q } from "@/server/db";

/** Mark a table request done. Safe to tap twice. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { rows } = await q("update service_requests set resolved_at = now(), resolved_by = $2 where id = $1 and resolved_at is null returning id", [id, ctx.user!.id]);
    if (!rows.length) {
      const exists = await q("select 1 from service_requests where id = $1", [id]);
      if (!exists.rows.length) throw notFound("Request");
    }
    return { ok: true };
  },
  { permission: ["orders.manage", "billing.manage", "kitchen.update"] },
);
