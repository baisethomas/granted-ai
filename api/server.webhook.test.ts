// @vitest-environment node
//
// Regression test for GRA-66: the Vercel production entry (this file)
// applied express.json() globally with no raw-body carve-out for
// /api/billing/webhook, so Stripe signature verification — which requires
// the exact original request bytes — always failed in production. This
// boots the real app this file builds and sends an actually-signed Stripe
// webhook payload through it, the same way Stripe's servers would.

import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../server/middleware/supabaseAuth.js", () => ({
  requireSupabaseUser: (req: any, _res: any, next: any) => {
    req.supabaseUser = { id: "webhook-test-user", email: "webhook-test-user@example.com" };
    next();
  },
  supabaseAdminClient: null,
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    embeddings = { create: vi.fn() };
  },
}));

const WEBHOOK_SECRET = "whsec_test_secret_for_gra66";

function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

let server: ReturnType<typeof import("http").createServer>;
let baseUrl = "";
const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const previousSecretKey = process.env.STRIPE_SECRET_KEY;

beforeAll(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key_for_gra66";

  // Exercise the same default Express export Vercel hosts in production.
  const { default: app } = await import("./server.js");
  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.on("listening", () => {
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
  if (previousWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
  if (previousSecretKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousSecretKey;
});

describe("POST /api/billing/webhook (production entry, GRA-66)", () => {
  it("accepts a validly-signed Stripe event — proves the raw body reaches signature verification unmodified", async () => {
    // A no-op event type: handleStripeWebhook only branches on
    // checkout.session.completed / customer.subscription.*, so this
    // isolates the body-parsing fix from the business logic it's wired to.
    const payload = JSON.stringify({
      id: "evt_gra66_test",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_gra66_test" } },
    });
    const signature = signStripePayload(payload, WEBHOOK_SECRET);

    const res = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signature },
      body: payload,
    });

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true, type: "payment_intent.succeeded" });
  });

  it("rejects a payload with an invalid signature — proves verification is still actually enforced", async () => {
    const payload = JSON.stringify({ id: "evt_gra66_bad", type: "payment_intent.succeeded" });
    const badSignature = signStripePayload(payload, "whsec_wrong_secret");

    const res = await fetch(`${baseUrl}/api/billing/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": badSignature },
      body: payload,
    });

    expect(res.status).toBe(400);
  });

  it("still parses JSON normally on other routes (global express.json() unaffected)", async () => {
    const res = await fetch(`${baseUrl}/api/definitely-not-a-real-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });

    // No real handler for this path — the point is Express's own body
    // parsing didn't throw or hang; it falls through to the 404 handler.
    expect(res.status).toBe(404);
  });
});
