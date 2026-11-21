import { api, body } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { SupplierSchema } from "@/server/inventory-admin";

export const GET = api(
  async () => {
    const { rows } = await q(
      `select s.*, coalesce(sum(p.total) filter (where p.status = 'received'), 0) as purchased,
              coalesce(sum(p.total - p.amount_paid) filter (where p.status = 'received'), 0) as outstanding,
              count(p.id) filter (where p.status = 'received')::int as purchases, max(p.purchased_on)::text as last_purchase
         from suppliers s left join purchases p on p.supplier_id = s.id
        group by s.id order by s.is_active desc, s.name`,
    );
    return { suppliers: rows };
  },
  { permission: ["purchases.manage", "inventory.view"] },
);

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, SupplierSchema);
    return tx(async (t) => {
      const { rows } = await t.query<{ id: string }>(
        "insert into suppliers (name, contact_name, phone, email, gstin, address, notes, is_active) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
        [input.name, input.contact_name, input.phone, input.email, input.gstin, input.address, input.notes, input.is_active],
      );
      await audit(t, ctx, "create", "supplier", rows[0].id, `Added supplier ${input.name}`);
      return rows[0];
    });
  },
  { permission: "purchases.manage" },
);
