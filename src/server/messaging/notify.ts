import "server-only";
import { z } from "zod";
import { q, tx, type Queryable } from "../db";
import { getSetting } from "../settings";
import { sendMessage, type Channel } from "./providers";
import { expirePoints } from "../loyalty";

/**
 * Notifications: templates → campaigns (or the birthday job) → a queue of messages → providers.
 *  - Marketing goes only to customers who opted in (marketing_consent) and haven't unsubscribed.
 *  - Every message is a row; the provider's id and delivery status are kept for the delivery log.
 *  - dedupe_key makes each campaign × customer and each birthday × year send at most once.
 *  - Promotional messages always carry an unsubscribe link.
 */

export const AudienceSchema = z.discriminatedUnion("segment", [
  z.object({ segment: z.literal("all") }),
  z.object({ segment: z.literal("birthday_month") }),
  z.object({ segment: z.literal("inactive"), days: z.number().int().min(7).max(730) }),
  z.object({ segment: z.literal("recent"), days: z.number().int().min(1).max(365) }),
  z.object({ segment: z.literal("points"), min_points: z.number().int().min(1).max(1_000_000) }),
]);
export type Audience = z.infer<typeof AudienceSchema>;

export const CampaignSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  template_id: z.string().uuid("Choose a message"),
  audience: AudienceSchema,
  notes: z.string().trim().max(300).default(""),
});

const destCol = (ch: Channel) => (ch === "email" ? "email" : "phone");

function audienceWhere(a: Audience, ch: Channel, params: unknown[]) {
  const w = [`c.is_active`, `c.marketing_consent`, `c.unsubscribed_at is null`, `c.${destCol(ch)} is not null`, `c.${destCol(ch)} <> ''`];
  if (a.segment === "birthday_month") w.push(`c.dob is not null and extract(month from c.dob) = extract(month from now() at time zone 'Asia/Kolkata')`);
  if (a.segment === "inactive") w.push(`(c.last_order_at is null or c.last_order_at < now() - make_interval(days => $${params.push(a.days)}))`);
  if (a.segment === "recent") w.push(`c.last_order_at >= now() - make_interval(days => $${params.push(a.days)})`);
  if (a.segment === "points") w.push(`c.points_balance >= $${params.push(a.min_points)}`);
  return w.join(" and ");
}

export async function audienceCount(a: Audience, ch: Channel, db: Queryable | null = null) {
  const run = db ? db.query.bind(db) : q;
  const params: unknown[] = [];
  const { rows } = await run<{ n: number; total: number }>(
    `select count(*) filter (where ${audienceWhere(a, ch, params)})::int as n, count(*) filter (where c.is_active)::int as total from customers c`,
    params,
  );
  return rows[0];
}

export function describeAudience(a: Audience) {
  switch (a.segment) {
    case "all":
      return "All subscribed customers";
    case "birthday_month":
      return "Birthdays this month";
    case "inactive":
      return `Haven't ordered in ${a.days} days`;
    case "recent":
      return `Ordered in the last ${a.days} days`;
    case "points":
      return `${a.min_points}+ points`;
  }
}

export function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export interface RenderVars {
  first_name: string;
  name: string;
  points: number;
  business: string;
  unsubscribe_url: string;
}

export function render(tpl: string, v: RenderVars) {
  return tpl.replace(/\{\{\s*(first_name|name|points|business|unsubscribe_url)\s*\}\}/g, (_, k: keyof RenderVars) => String(v[k] ?? ""));
}

/** Text with the unsubscribe line appended when the template doesn't include it. */
export function withOptOut(body: string, ch: Channel, url: string) {
  if (body.includes(url)) return body;
  return ch === "email" ? `${body}\n\n—\nDon't want these emails? Unsubscribe: ${url}` : `${body}\nOpt out: ${url}`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const textToHtml = (s: string) =>
  `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#23324C;max-width:560px">${escapeHtml(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2F6AA8">$1</a>')}</p>`)
    .join("")}</div>`;

interface Recipient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points_balance: number;
  unsubscribe_token: string;
}

async function enqueueFor(
  db: Queryable,
  recipients: Recipient[],
  t: { id: string; channel: Channel; subject: string; body: string; kind: string },
  opts: { campaignId: string | null; dedupe: (r: Recipient) => string; promotional: boolean },
) {
  const business = (await getSetting("business", db)).name;
  let queued = 0;
  for (const r of recipients) {
    const dest = t.channel === "email" ? r.email : r.phone;
    if (!dest) continue;
    const unsub = `${siteBase()}/unsubscribe/${r.unsubscribe_token}`;
    const vars = { first_name: r.name.split(/\s+/)[0], name: r.name, points: r.points_balance, business, unsubscribe_url: unsub };
    let body = render(t.body, vars);
    if (opts.promotional) body = withOptOut(body, t.channel, unsub);
    const res = await db.query(
      `insert into notifications (campaign_id, template_id, customer_id, kind, channel, destination, subject, body, dedupe_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (dedupe_key) do nothing`,
      [opts.campaignId, t.id, r.id, t.kind, t.channel, dest, render(t.subject, vars), body, opts.dedupe(r)],
    );
    queued += res.rowCount ?? 0;
  }
  return queued;
}

/** Turns a campaign into queued messages (once). */
export async function enqueueCampaign(campaignId: string) {
  return tx(async (db) => {
    const { rows } = await db.query<{ id: string; status: string; audience: Audience; template_id: string }>("select id, status, audience, template_id from campaigns where id = $1 for update", [campaignId]);
    const c = rows[0];
    if (!c || !["draft", "scheduled"].includes(c.status)) return { queued: 0 };
    const tpl = (await db.query<{ id: string; channel: Channel; subject: string; body: string; kind: string; is_active: boolean }>("select id, channel, subject, body, kind, is_active from notification_templates where id = $1", [c.template_id])).rows[0];
    if (!tpl?.is_active) {
      await db.query("update campaigns set status = 'failed', stats = jsonb_build_object('error','Template is inactive') where id = $1", [c.id]);
      return { queued: 0 };
    }
    const params: unknown[] = [];
    const where = audienceWhere(AudienceSchema.parse(c.audience), tpl.channel, params);
    const { rows: rec } = await db.query<Recipient>(`select c.id, c.name, c.phone, c.email, c.points_balance, c.unsubscribe_token from customers c where ${where}`, params);
    const queued = await enqueueFor(db, rec, tpl, { campaignId: c.id, dedupe: (r) => `campaign:${c.id}:${r.id}`, promotional: tpl.kind !== "transactional" });
    await db.query("update campaigns set status = 'sending', stats = jsonb_build_object('audience', $2::int, 'queued', $3::int) where id = $1", [c.id, rec.length, queued]);
    return { queued };
  });
}

/** Sends up to `limit` queued messages. Each is claimed first, so concurrent runs never double-send. */
export async function processQueue(limit = 100) {
  const result = { sent: 0, failed: 0, logged: 0 };
  const callback = process.env.TWILIO_STATUS_CALLBACK === "off" ? null : `${siteBase()}/api/webhooks/twilio`;
  for (let i = 0; i < limit; i++) {
    const { rows } = await q<{ id: number; channel: Channel; destination: string; subject: string; body: string; campaign_id: string | null }>(
      `update notifications set status = 'sending', attempts = attempts + 1
        where id = (select id from notifications where status = 'queued' order by id limit 1 for update skip locked)
        returning id, channel, destination, subject, body, campaign_id`,
    );
    const n = rows[0];
    if (!n) break;
    try {
      const r = await sendMessage(n.channel, n.destination, { subject: n.subject, text: n.body, html: n.channel === "email" ? textToHtml(n.body) : undefined, statusCallback: n.channel === "email" || !callback?.startsWith("https://") ? null : callback });
      if (r.provider === "dev-log") {
        // development without a provider: written to the server log only — never reported as sent
        await q("update notifications set status = 'skipped', provider = 'dev-log', error = 'Test mode: channel not set up, written to the server log only' where id = $1", [n.id]);
        result.logged++;
      } else {
        await q("update notifications set status = 'sent', provider = $2, provider_message_id = $3, sent_at = now(), error = null where id = $1", [n.id, r.provider, r.id]);
        result.sent++;
      }
    } catch (e) {
      await q("update notifications set status = 'failed', error = $2 where id = $1", [n.id, String((e as Error).message).slice(0, 300)]);
      result.failed++;
    }
  }
  await finishCampaigns();
  return result;
}

async function finishCampaigns() {
  await q(
    `update campaigns c set status = case when s.sent > 0 then 'sent' else 'failed' end, sent_at = coalesce(c.sent_at, now()),
            stats = c.stats || jsonb_build_object('sent', s.sent, 'failed', s.failed, 'delivered', s.delivered, 'not_sent_test_mode', s.logged)
                    || case when s.sent = 0 and s.logged > 0 then jsonb_build_object('error', 'Nothing was delivered — the channel isn''t set up (test mode)') else '{}'::jsonb end
       from (select campaign_id, count(*) filter (where status in ('sent','delivered'))::int as sent, count(*) filter (where status = 'failed')::int as failed,
                    count(*) filter (where status = 'skipped' and provider = 'dev-log')::int as logged,
                    count(*) filter (where status = 'delivered')::int as delivered, count(*) filter (where status in ('queued','sending'))::int as pending
               from notifications where campaign_id is not null group by campaign_id) s
      where s.campaign_id = c.id and c.status = 'sending' and s.pending = 0`,
  );
  // campaigns whose audience turned out empty
  await q("update campaigns set status = 'sent', sent_at = now() where status = 'sending' and not exists (select 1 from notifications n where n.campaign_id = campaigns.id)");
}

/** Birthday greetings, once per customer per year, at the configured hour (IST). */
export async function birthdayJob(force = false) {
  const s = await getSetting("notifications");
  if (!s.birthday_enabled || !s.birthday_template_ids.length) return { queued: 0, skipped: "disabled" };
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  if (!force && hour < s.send_hour) return { queued: 0, skipped: "too early" };
  const year = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 4);
  return tx(async (db) => {
    const { rows: tpls } = await db.query<{ id: string; channel: Channel; subject: string; body: string; kind: string }>(
      "select id, channel, subject, body, kind from notification_templates where id = any($1::uuid[]) and is_active",
      [s.birthday_template_ids],
    );
    let queued = 0;
    for (const t of tpls) {
      const { rows } = await db.query<Recipient>(
        `select c.id, c.name, c.phone, c.email, c.points_balance, c.unsubscribe_token from customers c
          where ${audienceWhere({ segment: "all" }, t.channel, [])}
            and c.dob is not null
            and to_char(c.dob, 'MM-DD') = to_char(now() at time zone 'Asia/Kolkata', 'MM-DD')`,
      );
      queued += await enqueueFor(db, rows, t, { campaignId: null, dedupe: (r) => `birthday:${year}:${t.channel}:${r.id}`, promotional: true });
    }
    return { queued };
  });
}

async function recordRun(name: string, fn: () => Promise<unknown>) {
  await q("insert into job_runs (name, last_started_at) values ($1, now()) on conflict (name) do update set last_started_at = now()", [name]);
  try {
    const r = await fn();
    await q("update job_runs set last_finished_at = now(), last_result = $2, last_error = null where name = $1", [name, JSON.stringify(r ?? {})]);
    return r;
  } catch (e) {
    await q("update job_runs set last_finished_at = now(), last_error = $2 where name = $1", [name, String((e as Error).message).slice(0, 300)]);
    throw e;
  }
}

/** Everything the scheduler runs. Safe to call as often as every few minutes. */
export async function runScheduledJobs() {
  const out: Record<string, unknown> = {};
  out.campaigns = await recordRun("campaigns", async () => {
    const { rows } = await q<{ id: string }>("select id from campaigns where status = 'scheduled' and scheduled_at <= now()");
    let queued = 0;
    for (const c of rows) queued += (await enqueueCampaign(c.id)).queued;
    return { due: rows.length, queued };
  });
  out.birthdays = await recordRun("birthdays", () => birthdayJob());
  out.points = await recordRun("points-expiry", () => tx((db) => expirePoints(db)));
  out.queue = await recordRun("send-queue", () => processQueue(200));
  // a message stuck in "sending" (process died mid-send) is retried once
  await q("update notifications set status = 'queued' where status = 'sending' and attempts < 2 and created_at < now() - interval '15 minutes'");
  return out;
}
