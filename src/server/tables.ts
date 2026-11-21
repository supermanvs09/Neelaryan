import "server-only";
import { z } from "zod";
import { q } from "./db";

export const TableInput = z.object({
  label: z.string().trim().regex(/^[A-Za-z0-9 -]{1,12}$/, "Use up to 12 letters, numbers, spaces or dashes"),
  name: z.string().trim().max(40).default(""),
  seats: z.coerce.number().int().min(1).max(50).default(4),
  area: z.string().trim().max(40).default(""),
  is_active: z.boolean().default(true),
});

/** Tables with live occupancy derived from open dine-in orders. */
export async function listTables(includeInactive = false) {
  const { rows } = await q<{
    id: string;
    label: string;
    name: string;
    seats: number;
    area: string;
    qr_token: string;
    is_active: boolean;
    sort: number;
    qr_generated_at: string;
    open_orders: number;
    since: string | null;
    due: number;
    ready: number;
  }>(
    `select t.id, t.label, t.name, t.seats, t.area, t.qr_token, t.is_active, t.sort, t.qr_generated_at,
            count(o.id)::int as open_orders, min(o.created_at) as since,
            coalesce(sum(o.total - o.amount_paid), 0) as due,
            count(o.id) filter (where o.status = 'ready')::int as ready
       from dining_tables t
       left join orders o on o.table_id = t.id and o.status in ('new','accepted','preparing','ready','served')
      ${includeInactive ? "" : "where t.is_active"}
      group by t.id order by t.sort, t.label`,
  );
  return rows.map((t) => ({ ...t, occupied: t.open_orders > 0 }));
}

/** Public base URL used in QR codes (falls back to the request origin). */
export function siteUrl(reqOrigin: string) {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || reqOrigin).replace(/\/+$/, "");
}

export const tableUrl = (base: string, token: string) => `${base}/t/${token}`;
