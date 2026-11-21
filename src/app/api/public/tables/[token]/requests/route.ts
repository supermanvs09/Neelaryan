import { z } from "zod";
import { api, body, ApiError, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { getSetting } from "@/server/settings";
import { REQUEST_KINDS, requestService } from "@/server/service";
import { notifyLater, pushStaff } from "@/server/push";
import { rateLimit } from "@/server/ratelimit";

const LABEL: Record<string, string> = { water: "Water", cutlery: "Spoon / plate", clean: "Clean the table", bill: "Bill please", help: "Needs help" };

const Schema = z.object({ kind: z.enum(REQUEST_KINDS) });

/** "Call staff" from the table: water, cutlery, cleaning, the bill, or help. */
export const POST = api(
  async (ctx) => {
    const token = z.string().regex(/^[A-Za-z0-9_-]{8,40}$/).safeParse(ctx.params.token);
    if (!token.success) throw notFound("This table");
    await rateLimit(`service:${ctx.ip ?? "?"}`, 30, 600);
    if (!(await getSetting("ordering")).accepting_orders) throw new ApiError(503, "The café is closed right now.", "CLOSED");
    const { kind } = await body(ctx.req, Schema);
    const r = await tx((t) => requestService(t, token.data, kind));
    if (r.created) notifyLater(() => pushStaff({ title: `Table ${r.table_label}: ${LABEL[kind]}`, body: "Tap to see table requests", url: "/admin/orders", tag: `req-${r.id}` }));
    return { id: r.id, kind: r.kind, created_at: r.created_at, resolved_at: r.resolved_at };
  },
  { auth: "public" },
);

/** Status of this device's recent requests (to show "Done"). */
export const GET = api(
  async (ctx) => {
    const ids = (ctx.req.nextUrl.searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
    if (!ids.length) return { requests: [] };
    const { rows } = await q(
      `select r.id, r.kind, r.created_at, r.resolved_at from service_requests r join dining_tables t on t.id = r.table_id
        where r.id = any($1::uuid[]) and t.qr_token = $2`,
      [ids, ctx.params.token],
    );
    return { requests: rows };
  },
  { auth: "public" },
);
