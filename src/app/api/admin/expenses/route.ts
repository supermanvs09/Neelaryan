import { z } from "zod";
import { api, body, bad, csv, searchParams } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().uuid().optional(),
  include_void: z.enum(["0", "1"]).default("0"),
  format: z.enum(["json", "csv"]).default("json"),
});

const ExpenseSchema = z.object({
  category_id: z.string().uuid("Choose a category"),
  amount: z.number().positive("Enter an amount").max(10_000_000),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  vendor: z.string().trim().max(80).default(""),
  payment_method: z.enum(["cash", "upi", "card", "bank", "other"]).default("cash"),
  notes: z.string().trim().max(300).default(""),
});

export const GET = api(
  async (ctx) => {
    const f = searchParams(ctx.req, Query);
    const params: unknown[] = [f.from, f.to];
    let where = "e.spent_on between $1 and $2";
    if (f.category) where += ` and e.category_id = $${params.push(f.category)}`;
    if (f.include_void === "0" || f.format === "csv") where += " and not e.is_void";
    const [rows, cats] = await Promise.all([
      q<{ id: string; spent_on: string; category: string; category_id: string; amount: number; vendor: string; payment_method: string; notes: string; is_void: boolean; void_reason: string | null; created_by_name: string | null; created_at: string }>(
        `select e.id, e.spent_on::text, c.name as category, e.category_id, e.amount, e.vendor, e.payment_method, e.notes, e.is_void, e.void_reason, u.name as created_by_name, e.created_at
           from expenses e join expense_categories c on c.id = e.category_id left join users u on u.id = e.created_by
          where ${where} order by e.spent_on desc, e.created_at desc limit 2000`,
        params,
      ),
      q("select id, name from expense_categories where is_active order by sort, name"),
    ]);
    if (f.format === "csv") {
      return csv(`expenses-${f.from}-to-${f.to}.csv`, [
        ["Date", "Category", "Amount (₹)", "Paid to", "Method", "Notes", "Entered by"],
        ...rows.rows.map((r) => [r.spent_on, r.category, r.amount, r.vendor, r.payment_method, r.notes, r.created_by_name ?? ""]),
      ]);
    }
    return { expenses: rows.rows, categories: cats.rows };
  },
  { permission: ["expenses.manage", "finance.view"] },
);

export const POST = api(
  async (ctx) => {
    const input = await body(ctx.req, ExpenseSchema);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (input.spent_on > today) throw bad("The date can't be in the future.", { spent_on: "Can't be in the future" });
    return tx(async (t) => {
      const c = await t.query<{ name: string }>("select name from expense_categories where id = $1 and is_active", [input.category_id]);
      if (!c.rows[0]) throw bad("Choose a category.", { category_id: "Choose a category" });
      const { rows } = await t.query<{ id: string }>(
        "insert into expenses (category_id, amount, spent_on, vendor, payment_method, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [input.category_id, input.amount, input.spent_on, input.vendor, input.payment_method, input.notes, ctx.user!.id],
      );
      await audit(t, ctx, "create", "expense", rows[0].id, `Recorded expense ₹${input.amount} (${c.rows[0].name})`, input);
      return rows[0];
    });
  },
  { permission: "expenses.manage" },
);
