import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { freshDb } from "./helpers";
import type { Db } from "@/server/db";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

describe("Supabase lockdown", () => {
  it("enables row-level security on every table", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
    );
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it("denies Supabase's public API roles (when they exist)", async () => {
    const roles = await db.query<{ n: number }>("select count(*)::int as n from pg_roles where rolname in ('anon','authenticated')");
    if (roles.rows[0].n < 2) return; // plain Postgres / PGlite: nothing to check
    // as on Supabase: the API roles can use the schema and were granted everything by default
    await db.query("grant usage on schema public to anon, authenticated");
    await db.query("grant select, insert, update, delete on all tables in schema public to anon, authenticated");
    const { lockdownSql } = await import("@/server/db/migrations");
    await db.query(lockdownSql); // what the app runs on every start
    await expect(
      db.tx(async (t) => {
        await t.query("set local role anon");
        await t.query("select count(*) from customers");
      }),
    ).rejects.toThrow(/permission denied/);
    // and the app (table owner) still works
    const r = await db.query<{ n: number }>("select count(*)::int as n from menu_items");
    expect(r.rows[0].n).toBeGreaterThan(0);
  });
});

describe("Supabase Storage", () => {
  let server: Server;
  const seen: { method: string; url: string; auth: string | undefined; type: string | undefined; size: number }[] = [];
  beforeAll(async () => {
    server = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, type: req.headers["content-type"], size: Buffer.concat(chunks).length });
      res.setHeader("content-type", "application/json");
      if (req.url === "/storage/v1/bucket") return res.writeHead(409).end(JSON.stringify({ message: "The resource already exists" }));
      res.writeHead(200).end(JSON.stringify({ Key: req.url }));
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  });
  afterAll(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    server.close();
  });

  it("creates the bucket once, uploads with the service key and returns a public URL", async () => {
    const { uploadToStorage, publicUrl, supabaseStorageEnabled } = await import("@/server/storage");
    expect(supabaseStorageEnabled()).toBe(true);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const path = await uploadToStorage(png, "image/png");
    await uploadToStorage(png, "image/png");
    expect(path).toMatch(/^items\/\d{4}-\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(seen.filter((s) => s.url === "/storage/v1/bucket")).toHaveLength(1);
    const up = seen.find((s) => s.url.startsWith("/storage/v1/object/menu-images/items/"))!;
    expect(up).toMatchObject({ method: "POST", auth: "Bearer service-role-test-key", type: "image/png", size: png.length });
    expect(publicUrl(path)).toBe(`${process.env.SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`);
  });
});
