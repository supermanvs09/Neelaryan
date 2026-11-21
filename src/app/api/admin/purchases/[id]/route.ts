import { z } from "zod";
import { api, notFound } from "@/server/http";
import { q } from "@/server/db";

export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { rows } = await q(
      `select p.*, p.purchased_on::text as purchased_on, s.name as supplier, u.name as created_by_name
         from purchases p left join suppliers s on s.id = p.supplier_id left join users u on u.id = p.created_by where p.id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound("Purchase");
    const lines = await q(
      `select l.id, l.item_id, i.name, i.display_unit, l.qty, l.unit_cost, l.line_total, l.expiry_date::text
         from purchase_lines l join inventory_items i on i.id = l.item_id where l.purchase_id = $1 order by i.name`,
      [id],
    );
    return { purchase: rows[0], lines: lines.rows };
  },
  { permission: ["purchases.manage", "finance.view"] },
);
