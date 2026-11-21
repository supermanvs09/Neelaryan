import { z } from "zod";
import { api, body, bad, conflict, notFound } from "@/server/http";
import { tx } from "@/server/db";
import { audit } from "@/server/audit";
import { SUPER_ADMIN, isPermission } from "@/server/auth/permissions";

const Schema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).default(""),
  permissions: z.array(z.string()).max(60),
});

/** Edits a role's permissions. Takes effect on the members' very next request (checked server-side every time). */
export const PATCH = api(
  async (ctx) => {
    const key = z.string().max(40).parse(ctx.params.key);
    if (key === SUPER_ADMIN) throw conflict("The Super Admin role always has every permission.");
    const v = await body(ctx.req, Schema);
    const perms = [...new Set(v.permissions.filter(isPermission))];
    if (perms.includes("staff.manage")) throw bad("Only the Super Admin role can manage staff.");
    await tx(async (t) => {
      const { rows } = await t.query<{ permissions: string[]; name: string }>("select permissions, name from roles where key = $1 for update", [key]);
      if (!rows[0]) throw notFound("Role");
      await t.query("update roles set name=$2, description=$3, permissions=$4 where key=$1", [key, v.name, v.description, perms]);
      const added = perms.filter((p) => !rows[0].permissions.includes(p));
      const removed = rows[0].permissions.filter((p) => !perms.includes(p as never));
      await audit(t, ctx, "update", "role", key, `Changed permissions for ${v.name}`, { added, removed });
    });
    return { ok: true };
  },
  { permission: "staff.manage" },
);

export const DELETE = api(
  async (ctx) => {
    const key = z.string().max(40).parse(ctx.params.key);
    await tx(async (t) => {
      const { rows } = await t.query<{ name: string; is_system: boolean }>("select name, is_system from roles where key = $1", [key]);
      if (!rows[0]) throw notFound("Role");
      if (rows[0].is_system || ["manager", "staff", "kitchen"].includes(key)) throw conflict("Built-in roles can't be deleted — edit their permissions instead.");
      const used = await t.query("select 1 from users where role_key = $1 limit 1", [key]);
      if (used.rows.length) throw conflict("Move the staff with this role to another role first.");
      await t.query("delete from roles where key = $1", [key]);
      await audit(t, ctx, "delete", "role", key, `Deleted role ${rows[0].name}`);
    });
    return { ok: true };
  },
  { permission: "staff.manage" },
);
