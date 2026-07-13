// @vitest-environment node

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// rateLimiter.ts reads its budget from env at module evaluation, so this must
// run before the registerRoutes import chain pulls it in.
vi.hoisted(() => {
  process.env.EARLY_ACCESS_RATE_LIMIT_MAX_REQUESTS = "10";
  process.env.EARLY_ACCESS_RATE_LIMIT_WINDOW_MS = "3600000";
});

import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";

vi.mock("./middleware/supabaseAuth.js", () => ({
  requireSupabaseUser: (req: any, _res: any, next: any) => {
    req.supabaseUser = { id: "route-test-user", email: "route-test-user@example.com" };
    next();
  },
  supabaseAdminClient: {},
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    embeddings = { create: vi.fn() };
  },
}));

let server: ReturnType<typeof import("http").createServer>;
let baseUrl = "";

async function postSignup(body: unknown) {
  return fetch(`${baseUrl}/api/early-access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signupEmails(): string[] {
  // MemStorage keeps signups in a private map; reach in for assertions.
  const map = (storage as any).earlyAccessSignups as Map<string, { email: string }>;
  return Array.from(map.keys());
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("POST /api/early-access", () => {
  it("records a valid signup without authentication", async () => {
    const res = await postSignup({ email: "director@nonprofit.org", source: "hero" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signupEmails()).toContain("director@nonprofit.org");
  });

  it("normalizes case/whitespace and succeeds silently on duplicates", async () => {
    const res = await postSignup({ email: "  Director@Nonprofit.org ", source: "cta" });
    expect(res.status).toBe(200);
    expect(signupEmails().filter((e) => e === "director@nonprofit.org")).toHaveLength(1);
  });

  it("rejects an invalid email with 400", async () => {
    const res = await postSignup({ email: "not-an-email" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("rejects a missing body with 400", async () => {
    const res = await postSignup({});
    expect(res.status).toBe(400);
  });

  it("rate limits repeated submissions from one IP", async () => {
    let limited: Response | undefined;
    // Budget is 10/window (set above). Failed requests are uncounted
    // (skipFailedRequests), so only the earlier 2 successful signups count.
    for (let i = 0; i < 10; i++) {
      const res = await postSignup({ email: `wave-${i}@nonprofit.org`, source: "hero" });
      if (res.status === 429) {
        limited = res;
        break;
      }
    }
    expect(limited).toBeDefined();
    const body = await limited!.json();
    expect(body.error).toBeTruthy();
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
