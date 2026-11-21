import { z } from "zod";
import { api, body, csv, requirePermission, searchParams } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { ProfileSchema, createCustomer } from "@/server/customers/account";

const Query = z.object({
  q: z.string().trim().max(60).optional(),
  segment: z.enum(["all", "subscribed", "birthday_month", "inactive", "top"]).default("all"),
  sort: z.enum(["recent", "spent", "points", "name", "visits"]).default("recent"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  format: z.enum(["json", "csv"]).default("json"),
});

const ORDER = {
  recent: "c.last_order_at desc nulls last, c.created_at desc",
  spent: "c.total_spent desc",
  points: "c.points_balance desc",
  name: "lower(c.name)",
  visits: "c.visits desc",
} as const;

export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [];
    const where = ["c.is_active"];
    if (f.q) {
      const s = f.q.replace(/\D/g, "").length >= 4 ? f.q.replace(/\D/g, "") : null;
      where.push(`(c.name ilike $${params.push(`%${f.q}%`)} or c.email ilike $${params.length}${s ? ` or c.phone like $${params.push(`%${s}%`)}` : ""})`);
    }
    if (f.segment === "subscribed") where.push("c.marketing_consent and c.unsubscribed_at is null");
    if (f.segment === "birthday_month") where.push("c.dob is not null and extract(month from c.dob) = extract(month from now() at time zone 'Asia/Kolkata')");
    if (f.segment === "inactive") where.push("(c.last_order_at is null or c.last_order_at < now() - interval '60 days')");
    if (f.segment === "top") where.push("c.visits >= 5");
    const w = where.join(" and ");
    const isCsv = f.format === "csv";
    if (isCsv) requirePermission(ctx, "customers.manage"); // exporting personal data
    const [rows, count, stats] = await Promise.all([
      q<{ id: string; name: string; phone: string | null; email: string | null; dob: string | null; marketing_consent: boolean; unsubscribed_at: string | null; points_balance: number; visits: number; total_spent: number; last_order_at: string | null; created_at: string }>(
        `select c.id, c.name, c.phone, c.email, c.dob::text, c.marketing_consent, c.unsubscribed_at, c.points_balance, c.lifetime_points, c.visits, c.total_spent,
                c.last_order_at, c.created_at, c.phone_verified_at is not null as phone_verified, c.source
           from customers c where ${w} order by ${ORDER[f.sort]} limit ${isCsv ? 50000 : f.limit} offset ${isCsv ? 0 : f.offset}`,
        params,
      ),
      q<{ n: number }>(`select count(*)::int as n from customers c where ${w}`, params),
      q(
        `select count(*)::int as total, count(*) filter (where marketing_consent and unsubscribed_at is null)::int as subscribed,
                count(*) filter (where created_at > now() - interval '30 days')::int as new_30d,
                count(*) filter (where last_order_at > now() - interval '30 days')::int as active_30d,
                coalesce(sum(points_balance), 0)::int as points_outstanding
           from customers where is_active`,
      ),
    ]);
    if (isCsv) {
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      await tx((t) => audit(t, ctx, "export", "customer", null, `Exported ${rows.rows.length} customers to CSV`, { segment: f.segment }));
      return csv(`customers-${day}.csv`, [
        ["Name", "Mobile", "Email", "Birthday", "Marketing consent", "Points", "Visits", "Total spent (₹)", "Last order", "Joined"],
        ...rows.rows.map((r) => [r.name, r.phone ?? "", r.email ?? "", r.dob ?? "", r.marketing_consent && !r.unsubscribed_at ? "Yes" : "No", r.points_balance, r.visits, r.total_spent, r.last_order_at ? new Date(r.last_order_at).toLocaleDateString("en-IN") : "", new Date(r.created_at).toLocaleDateString("en-IN")]),
      ]);
    }
    return { customers: rows.rows, total: count.rows[0].n, stats: stats.rows[0] };
  },
  { permission: ["customers.view", "orders.create"] },
);

const CreateSchema = ProfileSchema.extend({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  notes: z.string().trim().max(500).default(""),
});

/** Staff adding a customer at the counter. Consent only if the customer agreed in person. */
export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, CreateSchema);
    return tx(async (t) => {
      const dup = await t.query<{ id: string; name: string }>("select id, name from customers where phone = $1", [input.phone]);
      if (dup.rows[0]) return { id: dup.rows[0].id, existing: true, name: dup.rows[0].name };
      const id = await createCustomer(t, { ...input, source: "staff", consentSource: `Agreed in person — recorded by ${ctx.user!.name}`, notes: input.notes });
      await audit(t, ctx, "create", "customer", id, `Added customer ${input.name}`, { marketing_consent: input.marketing_consent });
      return { id, existing: false };
    });
  },
  { permission: ["customers.manage", "orders.create"] },
);
