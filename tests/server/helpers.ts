import { randomUUID } from "node:crypto";

/**
 * Integration tests run against a real Postgres. Point TEST_DATABASE_URL at a
 * throwaway database; the schema is dropped and rebuilt before the suite.
 * Without it, an in-memory PGlite is used.
 */
export async function freshDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: url });
    await client.connect();
    await client.query("drop schema public cascade; create schema public;");
    await client.end();
    process.env.DATABASE_URL = url;
  } else {
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = "memory";
  }
  (globalThis as { __neelDb?: unknown }).__neelDb = undefined;
  const { getDb } = await import("@/server/db");
  return getDb();
}

export const key = () => randomUUID();

/** A fake staff actor with every permission. */
export const admin = { userId: null, permissions: ["orders.manage", "kitchen.update"] as const };
