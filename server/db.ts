import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../shared/schema-simple";

if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith("postgres")) {
  console.warn(
    "DATABASE_URL is missing or not a Postgres connection string. Persistence will not work until it's set."
  );
}

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : undefined as any;
export const db = process.env.DATABASE_URL ? drizzle(sql, { schema }) : undefined as any;
export { schema };





