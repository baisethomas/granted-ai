// @vitest-environment node

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "./routes.js";
import { storage } from "./storage.js";
import { billingService } from "./services/billing.js";

vi.mock("./middleware/supabaseAuth.js", () => ({
  requireSupabaseUser: (req: any, _res: any, next: any) => {
    req.supabaseUser = {
      id: req.headers["x-test-user"] || "route-test-user",
      email: `${req.headers["x-test-user"] || "route-test-user"}@example.com`,
    };
    next();
  },
  supabaseAdminClient: {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/doc" } }),
      }),
    },
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
    embeddings = {
      create: vi.fn(),
    };
  },
}));

let server: ReturnType<typeof import("http").createServer>;
let baseUrl = "";

async function postJson(path: string, userId: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user": userId,
    },
    body: JSON.stringify(body),
  });
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

describe("billing route enforcement", () => {
  it("blocks project creation with 402 when the Starter project quota is reached", async () => {
    const userId = "route-project-limit";
    await billingService.ensureSubscription(userId);
    for (let i = 0; i < 5; i++) {
      await storage.createProject(userId, {
        title: `Seed Project ${i + 1}`,
        funder: "Seed Funder",
      });
    }

    const response = await postJson("/api/projects", userId, {
      title: "Blocked Project",
      funder: "Blocked Funder",
    });
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      error: "plan_limit_exceeded",
      limitType: "projects",
      plan: "starter",
      used: 5,
      limit: 5,
      upgradeRequired: true,
    });
  });

  it("blocks document upload with 402 when the Starter document quota is reached", async () => {
    const userId = "route-document-limit";
    await billingService.ensureSubscription(userId);
    for (let i = 0; i < 20; i++) {
      await storage.createDocument(userId, {
        organizationId: userId,
        filename: `doc-${i + 1}.txt`,
        originalName: `Document ${i + 1}.txt`,
        fileType: "text/plain",
        fileSize: 10,
        category: "organization-info",
      });
    }

    const form = new FormData();
    form.set("category", "organization-info");
    form.set("file", new Blob(["test"], { type: "text/plain" }), "blocked.txt");

    const response = await fetch(`${baseUrl}/api/documents/upload`, {
      method: "POST",
      headers: { "x-test-user": userId },
      body: form,
    });
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      error: "plan_limit_exceeded",
      limitType: "documents",
      plan: "starter",
      used: 20,
      limit: 20,
      upgradeRequired: true,
    });
  });

  it("blocks draft generation with 402 when estimated tokens would exceed quota", async () => {
    const userId = "route-token-limit";
    await billingService.ensureSubscription(userId);
    const project = await storage.createProject(userId, {
      title: "Token Project",
      funder: "Token Funder",
    });
    const question = await storage.createGrantQuestion(project.id, {
      question: "Describe the project need.",
      wordLimit: 500,
    });
    await billingService.recordUsage({
      organizationId: userId,
      userId,
      projectId: project.id,
      type: "generation",
      provider: "openai",
      model: "gpt-4o-mini",
      tokensIn: 99_000,
      tokensOut: 0,
      costCents: 0,
    });

    const response = await postJson(`/api/questions/${question.id}/generate`, userId, {
      tone: "professional",
      emphasisAreas: [],
    });
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body).toMatchObject({
      error: "plan_limit_exceeded",
      limitType: "ai_tokens",
      plan: "starter",
      used: 99_000,
      limit: 100_000,
      upgradeRequired: true,
    });
  });

  it("returns authenticated user's real billing usage instead of hard-coded org data", async () => {
    const userId = "route-billing-usage";
    await billingService.ensureSubscription(userId);
    await storage.createProject(userId, {
      title: "Usage Project",
      funder: "Usage Funder",
    });

    const response = await fetch(`${baseUrl}/api/billing/usage`, {
      headers: { "x-test-user": userId },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.organizationId).toBe(userId);
    expect(body.currentPeriod.projectsCreated).toBe(1);
    expect(body.limits.aiCredits).toBe(100_000);
  });
});
