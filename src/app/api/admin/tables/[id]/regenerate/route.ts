import { z } from "zod";
import { api, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { newQrToken } from "@/server/db/seed";
import { audit } from "@/server/audit";

/** New QR identifier: the old printed code stops working immediately. */
export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx(async (t) => {
      const { rows } = await t.query<{ label: string }>("update dining_tables set qr_token = $2, qr_generated_at = now() where id = $1 returning label", [id, newQrToken()]);
      if (!rows[0]) throw notFound("Table");
      await audit(t, ctx, "regenerate_qr", "table", id, `Regenerated the QR code for table ${rows[0].label} (old code disabled)`);
    });
    return { ok: true };
  },
  { permission: "tables.manage" },
);
