import { z } from "zod";
import { api, body, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { TemplateSchema } from "@/server/templates";

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const v = await body(ctx.req, TemplateSchema);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown>>("select name, channel, kind, subject, body, is_active from notification_templates where id = $1 for update", [id])).rows[0];
      if (!before) throw notFound("Message");
      if (before.channel !== v.channel) {
        const used = await t.query("select 1 from campaigns where template_id = $1 and status in ('scheduled','sending') limit 1", [id]);
        if (used.rows.length) throw conflict("A scheduled campaign uses this message — its channel can't change now.");
      }
      await t.query("update notification_templates set name=$2, channel=$3, kind=$4, subject=$5, body=$6, is_active=$7, updated_at=now() where id=$1", [id, v.name, v.channel, v.kind, v.subject, v.body, v.is_active]);
      await audit(t, ctx, "update", "template", id, `Updated message “${v.name}”`, diff(before, v));
    });
    return { ok: true };
  },
  { permission: "notifications.manage" },
);
