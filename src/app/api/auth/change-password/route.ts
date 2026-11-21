import { z } from "zod";
import { api, body, bad, ApiError } from "@/server/http";
import { q, tx } from "@/server/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";

const Schema = z
  .object({
    current: z.string().min(1, "Enter your current password").max(200),
    next: z.string().max(200),
    confirm: z.string().max(200),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords don't match.", path: ["confirm"] });

export const POST = api(
  async (ctx) => {
    const user = ctx.user!;
    const input = await body(ctx.req, Schema);
    await rateLimit(`pwchange:${user.id}`, 10, 15 * 60);
    const { rows } = await q<{ password_hash: string }>("select password_hash from users where id = $1", [user.id]);
    if (!rows[0] || !(await verifyPassword(input.current, rows[0].password_hash))) {
      throw new ApiError(400, "Your current password isn't right.", "INVALID", { current: "Your current password isn't right." });
    }
    const problem = passwordProblem(input.next, { username: user.username, current: input.current });
    if (problem) throw bad(problem, { next: problem });
    const hash = await hashPassword(input.next);
    await tx(async (t) => {
      await t.query("update users set password_hash = $2, must_change_password = false, password_changed_at = now(), updated_at = now() where id = $1", [user.id, hash]);
      // sign out every other device that used the old password
      await t.query("delete from sessions where user_id = $1 and id <> $2", [user.id, user.sessionId]);
      await audit(t, ctx, "password_change", "user", user.id, `${user.name} changed their password`);
    });
    return { ok: true };
  },
  { allowPendingPasswordChange: true },
);
