import { z } from "zod";
import { api, body, bad } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { getSetting, setSetting } from "@/server/settings";
import { channelStatus } from "@/server/messaging/providers";

/** Overview: which channels really work, background jobs, birthday settings, recent volume. */
export const GET = api(
  async () => {
    const [settings, jobs, counts, templates] = await Promise.all([
      getSetting("notifications"),
      q("select name, last_started_at, last_finished_at, last_result, last_error from job_runs order by name"),
      q(
        `select count(*) filter (where status in ('sent','delivered'))::int as sent, count(*) filter (where status = 'delivered')::int as delivered,
                count(*) filter (where status = 'failed')::int as failed, count(*) filter (where status in ('queued','sending'))::int as queued
           from notifications where created_at > now() - interval '30 days'`,
      ),
      q("select id, name, channel, kind, is_active from notification_templates order by kind, name"),
    ]);
    return { channels: channelStatus(), settings, jobs: jobs.rows, last30: counts.rows[0], templates: templates.rows };
  },
  { permission: "notifications.manage" },
);

const Schema = z.object({
  birthday_enabled: z.boolean(),
  birthday_template_ids: z.array(z.string().uuid()).max(3),
  send_hour: z.number().int().min(6).max(21),
});

export const PUT = api(
  async (ctx) => {
    const input = await body(ctx.req, Schema);
    if (input.birthday_enabled && !input.birthday_template_ids.length) throw bad("Choose at least one birthday message.", { birthday_template_ids: "Choose a message" });
    await tx(async (t) => {
      if (input.birthday_template_ids.length) {
        const { rows } = await t.query<{ channel: string }>("select channel from notification_templates where id = any($1::uuid[]) and is_active", [input.birthday_template_ids]);
        if (rows.length !== input.birthday_template_ids.length) throw bad("A chosen message is inactive or missing.");
        if (new Set(rows.map((r) => r.channel)).size !== rows.length) throw bad("Choose at most one message per channel, so nobody gets two of the same kind.");
      }
      const before = await getSetting("notifications", t);
      await setSetting(t, "notifications", input);
      await audit(t, ctx, "update", "settings", "notifications", "Updated birthday message settings", diff(before as unknown as Record<string, unknown>, input));
    });
    return { ok: true };
  },
  { permission: "notifications.manage" },
);
