import assert from "node:assert/strict";

const baseUrl =
  process.env.AUTH_SMOKE_BASE_URL ||
  `http://localhost:${process.env.PORT || "5000"}`;

const token = process.env.SUPABASE_TEST_ACCESS_TOKEN;

if (!token) {
  console.error(
    "[auth-smoke] SUPABASE_TEST_ACCESS_TOKEN is required to run this smoke test."
  );
  process.exit(1);
}

async function run() {
  console.log(`[auth-smoke] Using API base URL: ${baseUrl}`);

  const unauthorized = await fetch(`${baseUrl}/api/projects`);
  const status = unauthorized.status;
  if (![401, 403].includes(status)) {
    throw new Error(
      `[auth-smoke] Expected 401 or 403 for anonymous request, received ${status}`
    );
  }
  console.log(`[auth-smoke] Anonymous access correctly rejected with ${status}.`);

  const authorized = await fetch(`${baseUrl}/api/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (authorized.status >= 400) {
    const body = await authorized.text();
    throw new Error(
      `[auth-smoke] Authorized request failed with status ${authorized.status}: ${body}`
    );
  }

  console.log(
    `[auth-smoke] Authorized request succeeded with status ${authorized.status}.`
  );
  try {
    await authorized.json();
    console.log("[auth-smoke] Response JSON parsed successfully.");
  } catch (error) {
    console.warn("[auth-smoke] Unable to parse response JSON:", error);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
