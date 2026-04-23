import { defineConfig } from "drizzle-kit";
import { config as loadDotenv } from "dotenv";

// Load .env so `npm run db:push` / `db:generate` / `db:studio` work the same
// way the dev server does, without requiring the user to export DATABASE_URL
// into their shell manually.
loadDotenv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file at the repo root (see .env.example) or export DATABASE_URL before running drizzle-kit."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema-simple.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
