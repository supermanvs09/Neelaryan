import { z } from "zod";
import { api, body, bad } from "@/server/http";
import { q, tx } from "@/server/db";
import { audit } from "@/server/audit";
import { PERMISSIONS, PERMISSION_GROUPS, SUPER_ADMIN, isPermission } from "@/server/auth/permissions";

export const GET = api(
  async () => {
    const { rows } = await q(
      `select r.key, r.name, r.description, r.permissions, r.is_system, (select count(*)::int from users u where u.role_key = r.key and u.is_active) as members
         from roles r order by r.is_system desc, r.name`,
    );
    return { roles: rows, catalogue: PERMISSIONS, groups: PERMISSION_GROUPS, super_admin: SUPER_ADMIN };
  },
  { permission: "staff.manage" },
);

const Schema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(40),
  description: z.string().trim().max(200).default(""),
  permissions: z.array(z.string()).max(60),
});

export const POST = api(
  async (ctx) => {
    const v = await body(ctx.req, Schema);
    const perms = v.permissions.filter(isPermission);
    if (perms.includes("staff.manage")) throw bad("Only the Super Admin role can manage staff.");
    const key = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "role";
    return tx(async (t) => {
      const exists = await t.query("select 1 from roles where key = $1", [key]);
      if (exists.rows.length) throw bad("A role with that name already exists.", { name: "Already exists" });
      await t.query("insert into roles (key, name, description, permissions) values ($1,$2,$3,$4)", [key, v.name, v.description, perms]);
      await audit(t, ctx, "create", "role", key, `Created role ${v.name}`, { permissions: perms });
      return { key };
    });
  },
  { permission: "staff.manage" },
);
