import { describe, expect, it } from "vitest";
import { BillingService, PLAN_LIMITS, checkUsageAgainstLimit } from "./billing.js";
import { MemStorage } from "../storage.js";

async function createProjects(store: MemStorage, userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await store.createProject(userId, {
      title: `Project ${i + 1}`,
      funder: "Test Funder",
    });
  }
}

async function createDocuments(store: MemStorage, userId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await store.createDocument(userId, {
      organizationId: userId,
      filename: `doc-${i + 1}.txt`,
      originalName: `Document ${i + 1}.txt`,
      fileType: "text/plain",
      fileSize: 100,
      category: "organization-info",
    });
  }
}

describe("BillingService", () => {
  it("creates a default active starter subscription when none exists", async () => {
    const store = new MemStorage();
    const service = new BillingService(store);

    const subscription = await service.ensureSubscription("user-1", "Test Org");

    expect(subscription.organizationId).toBe("user-1");
    expect(subscription.plan).toBe("starter");
    expect(subscription.status).toBe("active");
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(subscription.currentPeriodStart!.getTime());
  });

  it("computes current-period project, document, and AI token usage", async () => {
    const store = new MemStorage();
    const service = new BillingService(store);

    await service.ensureSubscription("user-1");
    await createProjects(store, "user-1", 2);
    await createDocuments(store, "user-1", 3);
    await service.recordUsage({
      organizationId: "user-1",
      userId: "user-1",
      type: "generation",
      provider: "openai",
      model: "gpt-4o-mini",
      tokensIn: 1200,
      tokensOut: 300,
      costCents: 1,
    });

    const summary = await service.getUsageSummary("user-1");

    expect(summary.usage.projects).toBe(2);
    expect(summary.usage.documents).toBe(3);
    expect(summary.usage.aiTokens).toBe(1500);
    expect(summary.usage.costCents).toBe(1);
  });

  it("allows usage below starter quota and denies usage at quota", async () => {
    const below = checkUsageAgainstLimit("projects", "starter", 4, PLAN_LIMITS.starter.projects, 1);
    const atLimit = checkUsageAgainstLimit("projects", "starter", 5, PLAN_LIMITS.starter.projects, 1);

    expect(below.allowed).toBe(true);
    expect(atLimit.allowed).toBe(false);
    if (!atLimit.allowed) {
      expect(atLimit.denial).toEqual({
        error: "plan_limit_exceeded",
        limitType: "projects",
        plan: "starter",
        used: 5,
        limit: 5,
        upgradeRequired: true,
      });
    }
  });

  it("uses higher Pro limits after subscription plan change", async () => {
    const store = new MemStorage();
    const service = new BillingService(store);
    const subscription = await service.ensureSubscription("user-1");
    await store.updateSubscription(subscription.id, { plan: "pro" } as any);
    await createProjects(store, "user-1", PLAN_LIMITS.starter.projects);

    const result = await service.checkLimit("user-1", "projects", 1);

    expect(result.allowed).toBe(true);
    expect(result.summary.plan).toBe("pro");
    expect(result.summary.limits.projects).toBe(PLAN_LIMITS.pro.projects);
  });
});
