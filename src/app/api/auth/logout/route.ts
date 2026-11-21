import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { destroySession, SESSION_COOKIE, cookieOptions } from "@/server/auth/session";

export const POST = api(
  async (ctx) => {
    if (ctx.user) await destroySession(ctx.user.sessionId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
    return res;
  },
  { auth: "public" },
);
