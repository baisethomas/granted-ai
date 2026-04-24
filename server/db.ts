import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../shared/schema-simple.js";
// Import postgres at top level - the import itself is fast (~40ms)
// We'll only call postgres() lazily when first needed
import postgres from "postgres";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
  console.warn(
    "DATABASE_URL is missing or not a Postgres connection string. Persistence will not work until it's set."
  );
}

// Lazy initialization - only create connection pool when first accessed
// The postgres() function creates a pool config but doesn't connect until first query
let _sql: ReturnType<typeof postgres> | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

export function getSql() {
  if (!process.env.DATABASE_URL) return undefined;
  if (!_sql) {
    // Tuned for serverless (e.g. Vercel Functions) fronted by Supabase's
    // transaction pooler (PgBouncer) on port 6543.
    // - prepare: false — PgBouncer in transaction mode does not support
    //   server-side prepared statements. Using defaults causes silent
    //   errors and connection churn.
    // - max: 1 — each Lambda instance only needs a single connection;
    //   a large pool just fills the upstream pooler with idle sessions
    //   and eventually causes CONNECT_TIMEOUT on new cold starts.
    // - idle_timeout: 20s — release connection quickly so frozen
    //   instances don't hold pooler slots.
    // - connect_timeout: 10s — fail fast instead of hanging for 30s.
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const url = process.env.DATABASE_URL;

    if (isServerless && /:5432\b/.test(url)) {
      console.warn(
        "[db] DATABASE_URL points at port 5432 (session pooler/direct) from a " +
        "serverless runtime. For Vercel, use the Supabase transaction pooler on " +
        "port 6543 to avoid CONNECT_TIMEOUT under cold starts."
      );
    }

    console.log("[db] Creating Postgres connection pool (lazy, on first DB access)...");
    _sql = postgres(url, {
      prepare: false,
      max: isServerless ? 1 : 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    console.log("[db] Postgres connection pool created (connection happens on first query)");
  }
  return _sql;
}

export function getDb() {
  if (!process.env.DATABASE_URL) return undefined;
  if (!_db) {
    const sqlInstance = getSql();
    if (sqlInstance) {
      _db = drizzle(sqlInstance, { schema });
    }
  }
  return _db;
}

// Export getters that will be called lazily when first accessed
// Using Proxy to intercept property access and initialize on demand
export const sql = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getSql();
    if (!instance) return undefined;
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const db = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) return undefined;
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export { schema };





