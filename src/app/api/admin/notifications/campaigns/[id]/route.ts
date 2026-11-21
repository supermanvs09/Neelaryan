import { z } from "zod";
import { api, body, bad, conflict, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { CampaignSchema, enqueueCampaign, processQueue } from "@/server/messaging/notify";
import { channelConfig, type Channel } from "@/server/messaging/providers";

/** Edit a draft. */
export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const v = await body(ctx.req, CampaignSchema);
    await tx(async (t) => {
      const { rows } = await t.query<{ status: string }>("select status from campaigns where id = $1 for update", [id]);
      if (!rows[0]) throw notFound("Campaign");
      if (rows[0].status !== "draft") throw conflict("Only drafts can be edited.");
      await t.query("update campaigns set name=$2, template_id=$3, audience=$4, notes=$5 where id=$1", [id, v.name, v.template_id, JSON.stringify(v.audience), v.notes]);
      await audit(t, ctx, "update", "campaign", id, `Edited campaign “${v.name}”`, v);
    });
    return { ok: true };
  },
  { permission: "notifications.manage" },
);

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send") }),
  z.object({ action: z.literal("schedule"), at: z.string().datetime({ offset: true }) }),
  z.object({ action: z.literal("cancel") }),
]);

/** Send now, schedule, or cancel. Refuses to send through a channel that isn't configured. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const a = await body(ctx.req, Action);
    const { rows } = await q<{ name: string; status: string; channel: Channel }>(
      "select c.name, c.status, t.channel from campaigns c join notification_templates t on t.id = c.template_id where c.id = $1",
      [id],
    );
    const c = rows[0];
    if (!c) throw notFound("Campaign");
    if (a.action === "cancel") {
      await tx(async (t) => {
        const r = await t.query("update campaigns set status = 'cancelled' where id = $1 and status in ('draft','scheduled') returning id", [id]);
        if (!r.rowCount) throw conflict("This campaign has already started sending.");
        await audit(t, ctx, "cancel", "campaign", id, `Cancelled campaign “${c.name}”`);
      });
      return { ok: true };
    }
    if (!["draft", "scheduled"].includes(c.status)) throw conflict("This campaign has already been sent.");
    if (!channelConfig()[c.channel] && process.env.NODE_ENV === "production") {
      throw bad(`${c.channel === "email" ? "Email" : c.channel === "sms" ? "SMS" : "WhatsApp"} isn't set up, so this campaign can't be sent. See “Delivery channels”.`);
    }
    if (a.action === "schedule") {
      if (new Date(a.at).getTime() < Date.now() + 60_000) throw bad("Choose a time in the future.", { at: "Must be in the future" });
      await tx(async (t) => {
        await t.query("update campaigns set status = 'scheduled', scheduled_at = $2 where id = $1", [id, a.at]);
        await audit(t, ctx, "schedule", "campaign", id, `Scheduled campaign “${c.name}”`, { at: a.at });
      });
      return { ok: true, scheduled: true };
    }
    const { queued } = await enqueueCampaign(id);
    await tx((t) => audit(t, ctx, "send", "campaign", id, `Sent campaign “${c.name}” to ${queued} customer(s)`));
    // send the first batch now; anything left is sent by the scheduled job
    const sent = await processQueue(200);
    return { queued, ...sent };
  },
  { permission: "notifications.manage" },
);
