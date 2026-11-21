import { api, body } from "@/server/http";
import { tx } from "@/server/db";
import { listTables, siteUrl, tableUrl, TableInput } from "@/server/tables";
import { newQrToken } from "@/server/db/seed";
import { audit } from "@/server/audit";

export const GET = api(
  async (ctx) => {
    const base = siteUrl(ctx.req.nextUrl.origin);
    const all = ctx.req.nextUrl.searchParams.get("all") === "1";
    const tables = await listTables(all);
    return { tables: tables.map((t) => ({ ...t, url: tableUrl(base, t.qr_token) })) };
  },
  { permission: ["tables.view", "orders.view", "orders.create"] },
);

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, TableInput);
    const id = await tx(async (t) => {
      const sort = (await t.query<{ s: number }>("select coalesce(max(sort), 0) + 1 as s from dining_tables")).rows[0].s;
      const { rows } = await t.query<{ id: string }>("insert into dining_tables (label, name, seats, area, is_active, sort, qr_token) values ($1,$2,$3,$4,$5,$6,$7) returning id", [
        input.label,
        input.name,
        input.seats,
        input.area,
        input.is_active,
        sort,
        newQrToken(),
      ]);
      await audit(t, ctx, "create", "table", rows[0].id, `Added table ${input.label}`);
      return rows[0].id;
    });
    return { id };
  },
  { permission: "tables.manage" },
);
