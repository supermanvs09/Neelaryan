import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { SupplierSchema } from "@/server/inventory-admin";

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, SupplierSchema);
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown>>("select name, contact_name, phone, email, gstin, address, notes, is_active from suppliers where id = $1", [id])).rows[0];
      if (!before) throw notFound("Supplier");
      await t.query("update suppliers set name=$2, contact_name=$3, phone=$4, email=$5, gstin=$6, address=$7, notes=$8, is_active=$9 where id=$1", [
        id, input.name, input.contact_name, input.phone, input.email, input.gstin, input.address, input.notes, input.is_active,
      ]);
      await audit(t, ctx, "update", "supplier", id, `Updated supplier ${input.name}`, diff(before, input));
    });
    return { ok: true };
  },
  { permission: "purchases.manage" },
);
