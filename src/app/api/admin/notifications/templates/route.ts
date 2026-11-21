import { api, body } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { TemplateSchema } from "@/server/templates";

export const GET = api(
  async () => {
    const { rows } = await q(
      `select t.*, (select count(*)::int from campaigns c where c.template_id = t.id) as campaigns
         from notification_templates t order by t.is_active desc, t.kind, t.name`,
    );
    return { templates: rows };
  },
  { permission: "notifications.manage" },
);

export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, TemplateSchema);
    return tx(async (t) => {
      const { rows } = await t.query<{ id: string }>("insert into notification_templates (name, channel, kind, subject, body, is_active) values ($1,$2,$3,$4,$5,$6) returning id", [v.name, v.channel, v.kind, v.subject, v.body, v.is_active]);
      await audit(t, ctx, "create", "template", rows[0].id, `Created ${v.channel} message “${v.name}”`);
      return rows[0];
    });
  },
  { permission: "notifications.manage" },
);
