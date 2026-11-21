import "server-only";
import { q } from "./db";
import { ApiError } from "./http";

/**
 * Fixed-window rate limit stored in Postgres, so it holds across server
 * instances. Throws 429 when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, message = "Too many attempts. Please wait a few minutes and try again.") {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const { rows } = await q<{ count: number }>(
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart],
  );
  if (rows[0].count > limit) throw new ApiError(429, message, "RATE_LIMITED");
  // opportunistic cleanup of old windows
  if (Math.random() < 0.02) await q("delete from rate_limits where window_start < now() - interval '1 day'");
}
