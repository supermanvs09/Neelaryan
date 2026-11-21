import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { q } from "../db";
import type { Permission } from "./permissions";

export const SESSION_COOKIE = "nr_session";
export const SESSION_HOURS = 12;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
  roleName: string;
  permissions: Permission[];
  mustChangePassword: boolean;
  sessionId: string;
}

export async function createSession(userId: string, ip: string | null, userAgent: string | null) {
  const token = newToken();
  await q(
    `insert into sessions (id, user_id, expires_at, ip, user_agent)
     values ($1, $2, now() + make_interval(hours => $3), $4, $5)`,
    [sha256(token), userId, SESSION_HOURS, ip, userAgent?.slice(0, 300) ?? null],
  );
  return token;
}

/** Resolves a session cookie to an active user, sliding the expiry while in use. */
export async function userFromToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const { rows } = await q<{
    id: string;
    username: string;
    name: string;
    email: string | null;
    role_key: string;
    role_name: string;
    permissions: string[];
    must_change_password: boolean;
    last_seen_at: Date;
  }>(
    `select u.id, u.username, u.name, u.email, u.role_key, r.name as role_name, r.permissions, u.must_change_password, s.last_seen_at
       from sessions s join users u on u.id = s.user_id join roles r on r.key = u.role_key
      where s.id = $1 and s.expires_at > now() and u.is_active`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  if (Date.now() - new Date(r.last_seen_at).getTime() > 5 * 60_000) {
    await q(`update sessions set last_seen_at = now(), expires_at = now() + make_interval(hours => $2) where id = $1`, [id, SESSION_HOURS]);
  }
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email,
    role: r.role_key,
    roleName: r.role_name,
    permissions: r.permissions as Permission[],
    mustChangePassword: r.must_change_password,
    sessionId: id,
  };
}

export async function destroySession(sessionId: string) {
  await q("delete from sessions where id = $1", [sessionId]);
}

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});
