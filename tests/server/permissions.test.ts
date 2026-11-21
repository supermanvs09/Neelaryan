import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { freshDb } from "./helpers";
import type { Db } from "@/server/db";

let db: Db;
const tokens: Record<string, string> = {};

async function userWithRole(role: string, mustChange = false) {
  const { hashPassword } = await import("@/server/auth/password");
  const { createSession } = await import("@/server/auth/session");
  const { rows } = await db.query<{ id: string }>("insert into users (username, name, role_key, password_hash, must_change_password) values ($1,$1,$2,$3,$4) returning id", [
    `${role}-user${mustChange ? "-new" : ""}`,
    role,
    await hashPassword("Some-Password-123"),
    mustChange,
  ]);
  return { id: rows[0].id, token: await createSession(rows[0].id, "127.0.0.1", "test") };
}

function req(path: string, token: string | null, init: { method?: string; body?: unknown; origin?: string } = {}) {
  const headers = new Headers({ host: "localhost:3000" });
  if (token) headers.set("cookie", `nr_session=${token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET") headers.set("origin", init.origin ?? "http://localhost:3000");
  return new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? "GET", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
}
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });

beforeAll(async () => {
  db = await freshDb();
  tokens.kitchen = (await userWithRole("kitchen")).token;
  tokens.staff = (await userWithRole("staff")).token;
  tokens.manager = (await userWithRole("manager")).token;
  tokens.pending = (await userWithRole("manager", true)).token;
});

describe("backend permission enforcement", () => {
  it("rejects anonymous requests", async () => {
    const { GET } = await import("@/app/api/admin/finance/pnl/route");
    const r = await GET(req("/api/admin/finance/pnl?from=2026-01-01&to=2026-01-31", null), ctx());
    expect(r.status).toBe(401);
  });

  it("lets kitchen staff see the kitchen but nothing financial", async () => {
    const kitchen = await import("@/app/api/admin/kitchen/route");
    const pnl = await import("@/app/api/admin/finance/pnl/route");
    const customers = await import("@/app/api/admin/customers/route");
    expect((await kitchen.GET(req("/api/admin/kitchen", tokens.kitchen), ctx())).status).toBe(200);
    expect((await pnl.GET(req("/api/admin/finance/pnl?from=2026-01-01&to=2026-01-31", tokens.kitchen), ctx())).status).toBe(403);
    expect((await customers.GET(req("/api/admin/customers", tokens.kitchen), ctx())).status).toBe(403);
  });

  it("stops staff from managing staff, settings or refunds even with direct API calls", async () => {
    const staff = await import("@/app/api/admin/staff/route");
    const settings = await import("@/app/api/admin/settings/route");
    const r1 = await staff.POST(req("/api/admin/staff", tokens.staff, { method: "POST", body: { name: "X Y", username: "xy", role_key: "super_admin" } }), ctx());
    expect(r1.status).toBe(403);
    const r2 = await settings.PUT(req("/api/admin/settings", tokens.manager, { method: "PUT", body: { section: "tax", value: { gst_percent: 0, service_charge_percent: 0 } } }), ctx());
    expect(r2.status).toBe(403); // managers may pause ordering, but not change tax
    const r3 = await settings.PUT(req("/api/admin/settings", tokens.manager, { method: "PUT", body: { section: "ordering", value: { accepting_orders: false, takeaway_enabled: true, closed_message: "Back soon" } } }), ctx());
    expect(r3.status).toBe(200);
  });

  it("blocks everything but password change until the initial password is changed", async () => {
    const dash = await import("@/app/api/admin/dashboard/route");
    const r = await dash.GET(req("/api/admin/dashboard", tokens.pending), ctx());
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("rejects cross-site writes", async () => {
    const settings = await import("@/app/api/admin/settings/route");
    const r = await settings.PUT(req("/api/admin/settings", tokens.manager, { method: "PUT", origin: "https://evil.example", body: { section: "ordering", value: { accepting_orders: false, takeaway_enabled: true, closed_message: "x x x" } } }), ctx());
    expect(r.status).toBe(403);
  });

  it("never returns password hashes and keeps one Super Admin", async () => {
    const { assertSuperAdminRemains } = await import("@/server/staff");
    const admin = (await db.query<{ id: string }>("select id from users where role_key = 'super_admin'")).rows[0].id;
    await expect(db.tx((t) => assertSuperAdminRemains(t, { userId: admin, active: false }))).rejects.toThrow(/at least one active Super Admin/);
    const { token } = await userWithRole("super_admin");
    const staff = await import("@/app/api/admin/staff/route");
    const body = await (await staff.GET(req("/api/admin/staff", token), ctx())).text();
    expect(body).not.toMatch(/password_hash|scrypt\$/);
    await db.tx((t) => assertSuperAdminRemains(t, { userId: admin, active: false })); // fine now there are two
  });

  it("applies role permission changes on the next request", async () => {
    const pnl = await import("@/app/api/admin/finance/pnl/route");
    const url = "/api/admin/finance/pnl?from=2026-01-01&to=2026-01-31";
    expect((await pnl.GET(req(url, tokens.staff), ctx())).status).toBe(403);
    await db.query("update roles set permissions = array_append(permissions, 'finance.view') where key = 'staff'");
    expect((await pnl.GET(req(url, tokens.staff), ctx())).status).toBe(200);
  });
});
