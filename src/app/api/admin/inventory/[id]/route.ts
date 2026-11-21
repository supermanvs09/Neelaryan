import { z } from "zod";
import { api, body, notFound } from "@/server/http";
import { q, tx } from "@/server/db";
import { InvItemSchema, archiveInventoryItem, listInventory, saveInventoryItem } from "@/server/inventory-admin";

/** One item: details, batches, recent movements and where it's used. */
export const GET = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const item = (await listInventory(null, { includeInactive: true })).find((i) => i.id === id);
    if (!item) throw notFound("Inventory item");
    const [batches, movements, usedIn] = await Promise.all([
      q("select id, qty_received, qty_remaining, unit_cost, expiry_date::text, received_at from inventory_batches where item_id = $1 and qty_remaining > 0 order by expiry_date nulls last, received_at", [id]),
      q(
        `select m.id, m.kind, m.qty, m.unit_cost, m.value, m.reason, m.note, m.created_at, m.order_id, o.number as order_number, m.purchase_id, p.number as purchase_number, u.name as user_name
           from stock_movements m left join orders o on o.id = m.order_id left join purchases p on p.id = m.purchase_id left join users u on u.id = m.user_id
          where m.item_id = $1 order by m.created_at desc, m.id desc limit 100`,
        [id],
      ),
      q(
        `select m.name, r.qty, 'dish' as kind from recipe_lines r join menu_items m on m.id = r.menu_item_id and m.is_active where r.inventory_item_id = $1
         union all
         select g.name || ' — ' || m.name, r.qty, 'option' from modifier_recipe_lines r join modifiers m on m.id = r.modifier_id and m.is_active
           join modifier_groups g on g.id = m.group_id where r.inventory_item_id = $1 order by 1`,
        [id],
      ),
    ]);
    return { item, batches: batches.rows, movements: movements.rows, used_in: usedIn.rows };
  },
  { permission: "inventory.view" },
);

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const input = await body(ctx.req, InvItemSchema);
    await tx((t) => saveInventoryItem(t, ctx, id, input));
    return { ok: true };
  },
  { permission: "inventory.manage" },
);

export const DELETE = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    await tx((t) => archiveInventoryItem(t, ctx, id));
    return { ok: true };
  },
  { permission: "inventory.manage" },
);
