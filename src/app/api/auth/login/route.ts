import { NextResponse } from "next/server";
import { z } from "zod";
import { api, body, ApiError } from "@/server/http";
import { q, db } from "@/server/db";
import { verifyPassword, hashPassword } from "@/server/auth/password";
import { createSession, cookieOptions, SESSION_COOKIE, SESSION_HOURS } from "@/server/auth/session";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";

const Schema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(80),
  password: z.string().min(1, "Enter your password").max(200),
});

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

// used to keep response time similar for unknown usernames (no user enumeration by timing)
let dummyHash: Promise<string> | null = null;

export const POST = api(
  async (ctx) => {
    const { username, password } = await body(ctx.req, Schema);
    await rateLimit(`login:ip:${ctx.ip ?? "unknown"}`, 30, 15 * 60);
    const { rows } = await q<{
      id: string;
      name: string;
      password_hash: string;
      is_active: boolean;
      failed_attempts: number;
      locked_until: Date | null;
      must_change_password: boolean;
    }>("select id, name, password_hash, is_active, failed_attempts, locked_until, must_change_password from users where lower(username) = lower($1)", [username]);
    const u = rows[0];
    const fail = new ApiError(401, "That username and password don't match.", "BAD_CREDENTIALS");

    if (!u) {
      dummyHash ??= hashPassword("not-a-real-password-1");
      await verifyPassword(password, await dummyHash);
      throw fail;
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(u.locked_until).getTime() - Date.now()) / 60000);
      throw new ApiError(423, `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`, "LOCKED");
    }
    const ok = await verifyPassword(password, u.password_hash);
    if (!ok || !u.is_active) {
      if (u.is_active) {
        const attempts = u.failed_attempts + 1;
        if (attempts >= LOCK_AFTER) {
          await q("update users set failed_attempts = 0, locked_until = now() + make_interval(mins => $2) where id = $1", [u.id, LOCK_MINUTES]);
          await audit(db, { user: null, ip: ctx.ip }, "lockout", "user", u.id, `${u.name}'s account was locked after ${LOCK_AFTER} wrong passwords`);
        } else {
          await q("update users set failed_attempts = $2 where id = $1", [u.id, attempts]);
        }
      }
      throw u.is_active ? fail : new ApiError(403, "This account has been deactivated. Ask an administrator.", "INACTIVE");
    }

    await q("update users set failed_attempts = 0, locked_until = null, last_login_at = now() where id = $1", [u.id]);
    const token = await createSession(u.id, ctx.ip, ctx.req.headers.get("user-agent"));
    await audit(db, { user: { id: u.id, name: u.name, username } as never, ip: ctx.ip }, "login", "user", u.id, `${u.name} signed in`);
    const res = NextResponse.json({ ok: true, mustChangePassword: u.must_change_password });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_HOURS * 3600));
    return res;
  },
  { auth: "public" },
);
