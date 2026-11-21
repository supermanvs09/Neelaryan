import { z } from "zod";
import { api, body, bad, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { getSetting } from "@/server/settings";
import { render, siteBase, textToHtml, withOptOut } from "@/server/messaging/notify";
import { sendMessage, type Channel } from "@/server/messaging/providers";
import { rateLimit } from "@/server/ratelimit";

const Schema = z.object({ to: z.string().trim().min(5).max(120) });

/** Sends one real test message to staff, through the real provider, and reports exactly what happened. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { to } = await body(ctx.req, Schema);
    await rateLimit(`test-send:${ctx.user!.id}`, 10, 3600);
    const { rows } = await q<{ name: string; channel: Channel; subject: string; body: string; kind: string }>("select name, channel, subject, body, kind from notification_templates where id = $1", [id]);
    const t = rows[0];
    if (!t) throw notFound("Message");
    if (t.channel === "email" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) : !/^\+?\d{10,15}$/.test(to.replace(/[\s-]/g, ""))) {
      throw bad(t.channel === "email" ? "Enter an email address." : "Enter a mobile number.", { to: "Invalid" });
    }
    const business = (await getSetting("business")).name;
    const unsub = `${siteBase()}/unsubscribe/test`;
    const vars = { first_name: "Asha", name: "Asha Rao", points: 240, business, unsubscribe_url: unsub };
    let text = render(t.body, vars);
    if (t.kind !== "transactional") text = withOptOut(text, t.channel, unsub);
    const r = await sendMessage(t.channel, to.replace(/[\s-]/g, ""), { subject: `[Test] ${render(t.subject, vars)}`, text, html: t.channel === "email" ? textToHtml(text) : undefined });
    await tx((db) => audit(db, ctx, "test", "template", id, `Sent a test of “${t.name}”`, { to, provider: r.provider }));
    return { provider: r.provider, id: r.id, delivered_to_log_only: r.provider === "dev-log" };
  },
  { permission: "notifications.manage" },
);
