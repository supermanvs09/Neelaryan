import { api, notFound } from "@/server/http";
import { q } from "@/server/db";
import { rateLimit } from "@/server/ratelimit";

/** Resolves a scanned QR token to its table. Unknown or retired codes get a clear 404. */
export const GET = api(
  async (ctx) => {
    const token = ctx.params.token ?? "";
    if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) throw notFound("Table");
    await rateLimit(`qr:${ctx.ip ?? "?"}`, 120, 600);
    const { rows } = await q<{ id: string; label: string; name: string }>("select id, label, name from dining_tables where qr_token = $1 and is_active", [token]);
    if (!rows[0]) throw notFound("This table code");
    return { table: { label: rows[0].label, name: rows[0].name, token } };
  },
  { auth: "public" },
);
