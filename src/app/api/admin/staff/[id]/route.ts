import { z } from "zod";
import { api, body, bad, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit, diff } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { assertSuperAdminRemains, selfGuard, temporaryPassword } from "@/server/staff";

const Schema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")]).default(""),
  role_key: z.string().min(1),
  is_active: z.boolean(),
});

export const PATCH = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const v = await body(ctx.req, Schema);
    selfGuard(ctx, id, { role: v.role_key, active: v.is_active });
    await tx(async (t) => {
      const before = (await t.query<Record<string, unknown> & { username: string }>("select username, name, email, phone, role_key, is_active from users where id = $1 for update", [id])).rows[0];
      if (!before) throw notFound("Staff member");
      const role = await t.query("select 1 from roles where key = $1", [v.role_key]);
      if (!role.rows.length) throw bad("Choose a role.");
      await assertSuperAdminRemains(t, { userId: id, newRole: v.role_key, active: v.is_active });
      await t.query("update users set name=$2, email=$3, phone=$4, role_key=$5, is_active=$6, updated_at=now() where id=$1", [id, v.name, v.email || null, v.phone || null, v.role_key, v.is_active]);
      // a deactivated or re-roled account is signed out everywhere so new access applies immediately
      if (!v.is_active || before.role_key !== v.role_key) await t.query("delete from sessions where user_id = $1", [id]);
      const { username, ...b } = before;
      await audit(t, ctx, v.is_active ? "update" : "deactivate", "user", id, `${v.is_active ? "Updated" : "Deactivated"} staff account ${username}`, diff(b, { ...v, email: v.email || null, phone: v.phone || null }));
    });
    return { ok: true };
  },
  { permission: "staff.manage" },
);

const Action = z.object({ action: z.enum(["reset_password", "sign_out", "unlock"]) });

export const POST = api(
  async (ctx) => {
    const id = z.string().uuid().parse(ctx.params.id);
    const { action } = await body(ctx.req, Action);
    return tx(async (t) => {
      const { rows } = await t.query<{ username: string }>("select username from users where id = $1", [id]);
      if (!rows[0]) throw notFound("Staff member");
      if (action === "reset_password") {
        if (id === ctx.user!.id) throw bad("Use “Change password” on your account page instead.");
        const temp = temporaryPassword();
        await t.query("update users set password_hash = $2, must_change_password = true, failed_attempts = 0, locked_until = null, updated_at = now() where id = $1", [id, await hashPassword(temp)]);
        await t.query("delete from sessions where user_id = $1", [id]);
        await audit(t, ctx, "password_reset", "user", id, `Reset the password for ${rows[0].username}`);
        return { temporary_password: temp };
      }
      if (action === "unlock") {
        await t.query("update users set failed_attempts = 0, locked_until = null where id = $1", [id]);
        await audit(t, ctx, "unlock", "user", id, `Unlocked ${rows[0].username}`);
        return { ok: true };
      }
      await t.query("delete from sessions where user_id = $1 and id <> $2", [id, ctx.user!.sessionId]);
      await audit(t, ctx, "sign_out", "user", id, `Signed ${rows[0].username} out of all devices`);
      return { ok: true };
    });
  },
  { permission: "staff.manage" },
);
