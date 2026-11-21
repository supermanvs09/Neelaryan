import { z } from "zod";
import { api, body, bad, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { adjustStock } from "@/server/inventory";
import { audit } from "@/server/audit";
import { formatQty } from "@/lib/units";

const Schema = z
  .object({
    kind: z.enum(["wastage", "adjustment", "count", "opening"]),
    qty: z.number().min(-1e9).max(1e9), // base units; for "count" the counted total
    unit_cost: z.number().min(0).max(1e7).nullable().optional(), // per base unit, opening only
    reason: z.string().trim().max(60).default(""),
    note: z.string().trim().max(300).default(""),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  })
  .superRefine((v, c) => {
    if (v.kind !== "adjustment" && v.qty < 0) c.addIssue({ code: "custom", path: ["qty"], message: "Enter a positive quantity" });
    if ((v.kind === "wastage" || v.kind === "opening") && v.qty === 0) c.addIssue({ code: "custom", path: ["qty"], message: "Enter a quantity" });
    if ((v.kind === "wastage" || v.kind === "adjustment") && !v.reason) c.addIssue({ code: "custom", path: ["reason"], message: "Choose a reason" });
  });

const LABEL = { wastage: "Recorded wastage", adjustment: "Adjusted stock", count: "Stock count", opening: "Opening stock" } as const;

export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, Schema);
    return tx(async (t) => {
      const { rows } = await t.query<{ name: string; display_unit: string; stock_qty: number; track_expiry: boolean }>("select name, display_unit, stock_qty, track_expiry from inventory_items where id = $1 and is_active", [id]);
      const it = rows[0];
      if (!it) throw notFound("Inventory item");
      if (input.kind === "wastage" && input.qty > Number(it.stock_qty) + 1e-9) throw bad(`Only ${formatQty(Number(it.stock_qty), it.display_unit)} is in stock.`, { qty: "More than in stock" });
      if (input.kind === "opening" && it.track_expiry && !input.expiry_date) throw bad("Enter the expiry date for this stock.", { expiry_date: "Required for this item" });
      const r = await adjustStock(t, { item_id: id, ...input }, ctx.user!.id);
      await audit(t, ctx, input.kind, "inventory_item", id, `${LABEL[input.kind]}: ${it.name} ${r.delta >= 0 ? "+" : ""}${formatQty(r.delta, it.display_unit)}${input.reason ? ` (${input.reason})` : ""}`, { ...input, delta: r.delta });
      return r;
    });
  },
  { permission: "inventory.manage" },
);
