// Load environment variables as early as possible
import { config } from "dotenv";

// Configure dotenv to load .env file
config();

// Export a simple flag to ensure this module is loaded
export const envLoaded = true;

function resolveEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

const supabaseUrlCandidates = [
  "SUPABASE_URL",
  "SUPABASE_PROJECT_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
];

const supabaseServiceKeyCandidates = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SECRET_KEY",
];

export function validateEnvironment(): void {
  const supabaseUrl = resolveEnv(...supabaseUrlCandidates);
  const supabaseServiceRoleKey = resolveEnv(...supabaseServiceKeyCandidates);
  const hasDatabase = typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;

  if (!supabaseUrl) {
    console.warn(
      "[env] Supabase URL is not configured. Set SUPABASE_URL (or equivalent) for authenticated API access."
    );
  }

  if (!supabaseServiceRoleKey) {
    console.warn(
      "[env] Supabase service role key is missing. Set SUPABASE_SERVICE_ROLE_KEY (or equivalent) to enable token validation."
    );
  }

  if (hasDatabase) {
    console.info("[env] DATABASE_URL detected – Drizzle ORM will use Postgres persistence.");
  } else {
    console.warn(
      "[env] DATABASE_URL is not set. Falling back to in-memory storage – data will be lost on server restart."
    );
  }

  const bucket = process.env.DOCUMENTS_BUCKET || "documents";
  console.info(`[env] Using Supabase Storage bucket '${bucket}' for document uploads.`);

  if (process.env.DOCUMENT_WORKER_API_KEY) {
    console.info("[env] Document worker API key configured.");
  } else {
    console.warn("[env] DOCUMENT_WORKER_API_KEY not set. Scheduled worker endpoint will reject requests.");
  }
}
