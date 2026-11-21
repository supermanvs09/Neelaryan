import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { q } from "@/server/db";

const Query = z.object({
  status: z.enum(["queued", "sending", "sent", "delivered", "failed", "skipped"]).optional(),
  campaign: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Delivery log: every message, its provider id and status. Contact details are masked. */
export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [];
    const where: string[] = [];
    if (f.status) where.push(`n.status = $${params.push(f.status)}`);
    if (f.campaign) where.push(`n.campaign_id = $${params.push(f.campaign)}`);
    const { rows } = await q<{ destination: string; channel: string } & Record<string, unknown>>(
      `select n.id, n.kind, n.channel, n.destination, n.subject, n.status, n.provider, n.error, n.created_at, n.sent_at, n.delivered_at,
              c.name as customer, c.id as customer_id, cp.name as campaign
         from notifications n left join customers c on c.id = n.customer_id left join campaigns cp on cp.id = n.campaign_id
        ${where.length ? `where ${where.join(" and ")}` : ""} order by n.created_at desc, n.id desc limit ${f.limit}`,
      params,
    );
    const mask = (d: string, ch: string) => (ch === "email" ? d.replace(/^(.{2}).*(@.*)$/, "$1•••$2") : `•••••${d.slice(-4)}`);
    return { messages: rows.map((r) => ({ ...r, destination: mask(r.destination, r.channel) })) };
  },
  { permission: "notifications.manage" },
);
