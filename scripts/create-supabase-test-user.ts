/**
 * Creates or resets a Supabase Auth user for local email/password login (same flow as Login.tsx).
 * Requires SUPABASE_SERVICE_ROLE_KEY and Supabase URL in .env.local / .env.
 *
 * Usage: npm run auth:create-test-user
 *        npm run auth:create-test-user -- user@example.com MySecret123
 */
import "../server/config.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const email = process.argv[2] || "testuser@grantedai.app";
const password = process.argv[3] || "Password1";

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[auth:create-test-user] Missing Supabase URL or service role key. Set SUPABASE_SERVICE_ROLE_KEY " +
        "and VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in .env.local.",
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!createErr && created.user) {
    console.log(`[auth:create-test-user] Created Supabase user: ${created.user.email} (${created.user.id})`);
    return;
  }

  const dup =
    createErr?.message?.toLowerCase().includes("already") ||
    createErr?.message?.toLowerCase().includes("registered") ||
    createErr?.status === 422;

  if (!dup) {
    console.error("[auth:create-test-user] createUser failed:", createErr?.message ?? createErr);
    process.exit(1);
  }

  let userId: string | undefined;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data: pageData, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) {
      console.error("[auth:create-test-user] listUsers failed:", listErr.message);
      process.exit(1);
    }
    const match = pageData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) userId = match.id;
    if (!pageData.users.length) break;
  }

  if (!userId) {
    console.error("[auth:create-test-user] User exists but could not be looked up for password reset.");
    process.exit(1);
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (updErr) {
    console.error("[auth:create-test-user] updateUserById failed:", updErr.message);
    process.exit(1);
  }

  console.log(`[auth:create-test-user] Password updated for existing user: ${email} (${userId})`);
}

main().catch((e) => {
  console.error("[auth:create-test-user]", e);
  process.exit(1);
});
