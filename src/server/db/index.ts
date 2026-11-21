import "server-only";
import { migrations } from "./migrations";
import { seed } from "./seed";

/**
 * One database interface for the whole platform.
 *
 *  - DATABASE_URL set  → node-postgres pool (Supabase / any Postgres). Required in production.
 *  - not set (dev)      → embedded PGlite (real Postgres compiled to WASM) persisted in .data/,
 *                         so `npm run dev` works with zero setup.
 *
 * Migrations and the idempotent seed run once per process before the first query.
 */

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  kind: "postgres" | "pglite";
}

const numeric = (v: string) => (v === null ? null : Number(v));

async function createPg(url: string): Promise<Db> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  // numeric / int8 come back as strings by default — money and counts are numbers here
  types.setTypeParser(1700, numeric);
  types.setTypeParser(20, numeric);
  const ssl = /sslmode=require|supabase\.co|pooler\.supabase\.com/.test(url) ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10), ssl });
  return {
    kind: "postgres",
    async query(sql, params = []) {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn({
          async query(sql, params = []) {
            const r = await client.query(sql, params as unknown[]);
            return { rows: r.rows, rowCount: r.rowCount ?? 0 };
          },
        });
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const path = await import("node:path");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const db = await PGlite.create({
    ...(dir === "memory" ? {} : { dataDir: dir }),
    parsers: { 1700: numeric, 20: numeric }, // numeric, int8 → number
  });
  // PGlite runs on a single connection: serialise transactions so they never interleave
  let chain: Promise<unknown> = Promise.resolve();
  const wrap = <T,>(r: { rows: T[]; affectedRows?: number }) => ({ rows: r.rows, rowCount: r.affectedRows ?? r.rows.length });
  type Target = { query: typeof db.query; exec: typeof db.exec };
  // parameterless SQL may hold several statements (migrations): that needs exec()
  const run = async <T,>(t: Target, sql: string, params: unknown[]) => {
    if (!params.length && sql.includes(";")) {
      const results = await t.exec(sql);
      const last = results[results.length - 1];
      return wrap((last ?? { rows: [] }) as unknown as { rows: T[]; affectedRows?: number });
    }
    return wrap(await t.query<T>(sql, params));
  };
  return {
    kind: "pglite",
    async query(sql, params = []) {
      await chain;
      return run(db, sql, params as unknown[]);
    },
    tx(fn) {
      const run2 = chain.then(() => db.transaction((t) => fn({ query: (sql, params = []) => run(t as unknown as Target, sql, params as unknown[]) })));
      chain = run2.catch(() => undefined);
      return run2;
    },
  } as Db;
}

async function migrate(db: Db) {
  await db.query(`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`);
  await db.tx(async (q) => {
    if (db.kind === "postgres") await q.query("select pg_advisory_xact_lock(724119)");
    const { rows } = await q.query<{ version: string }>("select version from schema_migrations");
    const done = new Set(rows.map((r) => r.version));
    for (const m of migrations) {
      if (done.has(m.version)) continue;
      await q.query(m.sql);
      await q.query("insert into schema_migrations (version) values ($1)", [m.version]);
    }
    await seed(q);
  });
}

const g = globalThis as unknown as { __neelDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__neelDb) {
    g.__neelDb = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url && process.env.NODE_ENV === "production" && !process.env.ALLOW_EMBEDDED_DB) {
        throw new Error("DATABASE_URL is not configured. Set it to your Postgres (e.g. Supabase) connection string.");
      }
      const db = url ? await createPg(url) : await createPglite();
      await migrate(db);
      return db;
    })();
    g.__neelDb.catch(() => {
      g.__neelDb = undefined;
    });
  }
  return g.__neelDb;
}

/** Shorthand for a one-off query. */
export async function q<T = Row>(sql: string, params?: unknown[]) {
  return (await getDb()).query<T>(sql, params);
}

export async function tx<T>(fn: (q: Queryable) => Promise<T>) {
  return (await getDb()).tx(fn);
}

/** A Queryable bound to the shared pool, for helpers that accept either a pool or a transaction. */
export const db: Queryable = { query: (sql, params) => q(sql, params) };
