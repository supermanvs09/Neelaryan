import { z } from "zod";
import { api, body, bad } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { temporaryPassword } from "@/server/staff";

export const GET = api(
  async () => {
    const [users, roles] = await Promise.all([
      q(
        `select u.id, u.username, u.name, u.email, u.phone, u.role_key, r.name as role_name, u.is_active, u.must_change_password, u.last_login_at, u.created_at,
                u.locked_until > now() as locked, (select count(*)::int from sessions s where s.user_id = u.id and s.expires_at > now()) as sessions
           from users u join roles r on r.key = u.role_key order by u.is_active desc, lower(u.name)`,
      ),
      q("select key, name from roles order by is_system desc, name"),
    ]);
    return { staff: users.rows, roles: roles.rows };
  },
  { permission: "staff.manage" },
);

const Schema = z.object({
  name: z.string().trim().min(2, "Enter their name").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "3–30 letters, numbers, dots, dashes or underscores"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).default(""),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")]).default(""),
  role_key: z.string().min(1, "Choose a role"),
});

/** Creates a staff account with a one-time temporary password (returned once, never stored in clear). */
export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, Schema);
    return tx(async (t) => {
      const role = await t.query("select 1 from roles where key = $1", [v.role_key]);
      if (!role.rows.length) throw bad("Choose a role.", { role_key: "Choose a role" });
      const dup = await t.query("select 1 from users where lower(username) = $1", [v.username]);
      if (dup.rows.length) throw bad("That username is taken.", { username: "Already taken" });
      const temp = temporaryPassword();
      const { rows } = await t.query<{ id: string }>(
        "insert into users (username, name, email, phone, role_key, password_hash, must_change_password) values ($1,$2,$3,$4,$5,$6,true) returning id",
        [v.username, v.name, v.email || null, v.phone || null, v.role_key, await hashPassword(temp)],
      );
      await audit(t, ctx, "create", "user", rows[0].id, `Created staff account ${v.username} (${v.role_key})`, { role: v.role_key });
      return { id: rows[0].id, username: v.username, temporary_password: temp };
    });
  },
  { permission: "staff.manage" },
);
