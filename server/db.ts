import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../shared/schema-simple";
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
    console.log("[db] Creating Postgres connection pool (lazy, on first DB access)...");
    _sql = postgres(process.env.DATABASE_URL);
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





