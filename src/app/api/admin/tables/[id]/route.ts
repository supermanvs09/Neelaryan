import { z } from "zod";
import { api, body, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { TableInput } from "@/server/tables";

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, TableInput);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown>>("select label, name, seats, area, is_active from dining_tables where id = $1", [id])).rows[0];
      if (!before) throw notFound("Table");
      if (!input.is_active) {
        const open = await t.query("select 1 from orders where table_id = $1 and status in ('new','accepted','preparing','ready','served') limit 1", [id]);
        if (open.rows.length) throw conflict("This table has open orders. Settle them before switching it off.");
      }
      await t.query("update dining_tables set label=$2, name=$3, seats=$4, area=$5, is_active=$6 where id=$1", [id, input.label, input.name, input.seats, input.area, input.is_active]);
      await audit(t, ctx, "update", "table", id, `Updated table ${input.label}`, diff(before, input));
    });
    return { ok: true };
  },
  { permission: "tables.manage" },
);
