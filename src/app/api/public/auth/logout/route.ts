import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { q } from "@/server/db";
import { CUSTOMER_COOKIE } from "@/server/customers/session";

export const POST = api(
  async (ctx) => {
    if (ctx.customer) await q("delete from customer_sessions where id = $1", [ctx.customer.sessionId]);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(CUSTOMER_COOKIE);
    return res;
  },
  { auth: "public" },
);
