import { api, body, bad } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { CampaignSchema, describeAudience, type Audience } from "@/server/messaging/notify";

export const GET = api(
  async () => {
    const { rows } = await q<{ audience: Audience } & Record<string, unknown>>(
      `select c.id, c.name, c.status, c.audience, c.scheduled_at, c.sent_at, c.created_at, c.stats, c.notes, c.template_id,
              t.name as template, t.channel, u.name as created_by
         from campaigns c join notification_templates t on t.id = c.template_id left join users u on u.id = c.created_by
        order by c.created_at desc limit 200`,
    );
    return { campaigns: rows.map((r) => ({ ...r, audience_label: describeAudience(r.audience) })) };
  },
  { permission: "notifications.manage" },
);



export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, CampaignSchema);
    return tx(async (t) => {
      const tpl = await t.query<{ kind: string; is_active: boolean }>("select kind, is_active from notification_templates where id = $1", [v.template_id]);
      if (!tpl.rows[0]?.is_active) throw bad("Choose an active message.", { template_id: "Inactive" });
      const { rows } = await t.query<{ id: string }>("insert into campaigns (name, template_id, audience, notes, created_by) values ($1,$2,$3,$4,$5) returning id", [v.name, v.template_id, JSON.stringify(v.audience), v.notes, ctx.user!.id]);
      await audit(t, ctx, "create", "campaign", rows[0].id, `Created campaign “${v.name}”`, v);
      return rows[0];
    });
  },
  { permission: "notifications.manage" },
);
