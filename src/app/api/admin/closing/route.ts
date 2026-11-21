import { z } from "zod";
import { api, body, bad, searchParams } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { closeDay, dayFigures } from "@/server/service";
import { cafeClock } from "@/lib/offers";

const Query = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** A day's takings by method, its closing (if done) and recent closings. */
export const GET = api(
  async (ctx) => {
    const day = searchParams(ctx.req, Query).day ?? cafeClock().date;
    if (day > cafeClock().date) throw bad("That day hasn't happened yet.");
    const [figures, closing, last, history] = await Promise.all([
      dayFigures(day),
      q("select c.*, c.day::text as day, u.name as closed_by_name from day_closings c left join users u on u.id = c.closed_by where c.day = $1", [day]),
      q<{ opening_float: number }>("select opening_float from day_closings where day < $1 order by day desc limit 1", [day]),
      q("select c.day::text as day, c.expected_cash, c.counted_cash, c.difference, c.cash_received, c.upi_received, c.card_received, u.name as closed_by_name from day_closings c left join users u on u.id = c.closed_by order by c.day desc limit 30"),
    ]);
    return { day, figures, closing: closing.rows[0] ?? null, last_float: last.rows[0] ? Number(last.rows[0].opening_float) : null, history: history.rows };
  },
  { permission: ["finance.view", "billing.refund"] },
);

const money = z.number().min(0).max(10_000_000);
const Schema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opening_float: money,
  paid_out: money,
  counted: money,
  note: z.string().trim().max(200).default(""),
});

/** Close (or re-close) a day: opening float + cash received − cash paid out = expected; counted − expected = short/over. */
export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, Schema);
    const today = cafeClock().date;
    if (v.day < new Date(Date.parse(`${today}T00:00:00Z`) - 62 * 86400000).toISOString().slice(0, 10)) throw bad("Only the last two months can be closed.");
    return tx(async (t) => {
      const r = await closeDay(t, v, ctx.user!.id);
      const c = r.closing as { difference: number; counted_cash: number };
      const diffText = Number(c.difference) === 0 ? "cash matched" : `${Number(c.difference) < 0 ? "short" : "over"} by ₹${Math.abs(Number(c.difference))}`;
      await audit(t, ctx, r.reclosed ? "reclose" : "close", "day", v.day, `${r.reclosed ? "Re-closed" : "Closed"} ${v.day}: counted ₹${Number(c.counted_cash)}, ${diffText}`, { ...v, previous: r.previous });
      return r.closing;
    });
  },
  { permission: ["finance.view", "billing.refund"] },
);
