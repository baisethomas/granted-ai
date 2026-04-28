import type { Project, Document, InsertUsageEvent, Subscription, UsageEvent } from "../../shared/schema.js";
import { storage, type IStorage } from "../storage.js";

export type PlanName = "starter" | "pro" | "team" | "enterprise";
export type LimitType = "projects" | "documents" | "ai_tokens";

export interface PlanLimits {
  projects: number;
  documents: number;
  aiTokens: number;
  teamMembers: number;
}

export interface LimitDenial {
  error: "plan_limit_exceeded";
  limitType: LimitType;
  plan: PlanName;
  used: number;
  limit: number;
  upgradeRequired: true;
}

export interface UsageSummary {
  organizationId: string;
  plan: PlanName;
  status: string;
  period: {
    start: Date;
    end: Date;
  };
  usage: {
    projects: number;
    documents: number;
    aiTokens: number;
    costCents: number;
    eventsCount: number;
  };
  limits: PlanLimits;
  percentUsed: {
    projects: number;
    documents: number;
    aiTokens: number;
  };
}

const DEFAULT_PLAN: PlanName = "starter";

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  starter: {
    projects: 5,
    documents: 20,
    aiTokens: 100_000,
    teamMembers: 1,
  },
  pro: {
    projects: 50,
    documents: 250,
    aiTokens: 1_000_000,
    teamMembers: 1,
  },
  team: {
    projects: 50,
    documents: 250,
    aiTokens: 1_000_000,
    teamMembers: 1,
  },
  enterprise: {
    projects: 50,
    documents: 250,
    aiTokens: 1_000_000,
    teamMembers: 1,
  },
};

const MODEL_TOKEN_PRICING_USD: Record<string, { input: number; output: number }> = {
  "gpt-4": { input: 0.00003, output: 0.00006 },
  "gpt-4o": { input: 0.00001, output: 0.00003 },
  "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },
  "text-embedding-3-small": { input: 0.00000002, output: 0 },
};

function normalizePlan(plan: string | null | undefined): PlanName {
  if (plan === "pro" || plan === "team" || plan === "enterprise") return plan;
  return DEFAULT_PLAN;
}

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function isWithinPeriod(date: Date | string | null | undefined, start: Date, end: Date): boolean {
  if (!date) return false;
  const value = new Date(date);
  return !Number.isNaN(value.getTime()) && value >= start && value < end;
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function sumTokens(events: UsageEvent[]): number {
  return events.reduce((sum, event) => sum + (event.tokensIn ?? 0) + (event.tokensOut ?? 0), 0);
}

export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateCostCents(model: string | null | undefined, tokensIn = 0, tokensOut = 0): number {
  if (!model) return 0;
  const pricing = MODEL_TOKEN_PRICING_USD[model];
  if (!pricing) return 0;
  const dollars = tokensIn * pricing.input + tokensOut * pricing.output;
  return Math.max(0, Math.round(dollars * 100));
}

export function createLimitDenial(
  limitType: LimitType,
  plan: PlanName,
  used: number,
  limit: number
): LimitDenial {
  return {
    error: "plan_limit_exceeded",
    limitType,
    plan,
    used,
    limit,
    upgradeRequired: true,
  };
}

export function checkUsageAgainstLimit(
  limitType: LimitType,
  plan: PlanName,
  used: number,
  limit: number,
  requestedAmount: number
): { allowed: true } | { allowed: false; denial: LimitDenial } {
  if (used + requestedAmount <= limit) return { allowed: true };
  return {
    allowed: false,
    denial: createLimitDenial(limitType, plan, used, limit),
  };
}

export class BillingService {
  constructor(private readonly store: IStorage = storage) {}

  resolveOrganizationId(userId: string): string {
    return userId;
  }

  async ensureSubscription(userId: string, displayName?: string, requestedOrganizationId?: string): Promise<Subscription> {
    const organizationId = requestedOrganizationId ?? this.resolveOrganizationId(userId);
    if (requestedOrganizationId) {
      const allowed = await this.store.userHasOrganizationAccess(userId, organizationId);
      if (!allowed) {
        throw new Error("Forbidden");
      }
    } else {
      await this.store.ensureOrganization(organizationId, displayName);
    }

    const existing = await this.store.getSubscription(organizationId);
    if (existing) {
      const periodEnd = existing.currentPeriodEnd ? new Date(existing.currentPeriodEnd) : null;
      if (periodEnd && periodEnd <= new Date()) {
        const start = new Date();
        const updated = await this.store.updateSubscription(existing.id, {
          currentPeriodStart: start,
          currentPeriodEnd: addOneMonth(start),
        });
        return updated ?? existing;
      }
      return existing;
    }

    const start = new Date();
    return this.store.createSubscription({
      organizationId,
      plan: DEFAULT_PLAN,
      status: "active",
      currentPeriodStart: start,
      currentPeriodEnd: addOneMonth(start),
    });
  }

  async getUsageSummary(userId: string, requestedOrganizationId?: string): Promise<UsageSummary> {
    const organizationId = requestedOrganizationId ?? this.resolveOrganizationId(userId);
    const subscription = await this.ensureSubscription(userId, undefined, organizationId);
    const plan = normalizePlan(subscription.plan);
    const start = subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart) : new Date();
    const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : addOneMonth(start);
    const [projects, documents, events] = await Promise.all([
      this.store.getProjectsForOrganization(userId, organizationId),
      this.store.getDocumentsForOrganization(userId, organizationId),
      this.store.getUsageEventsForPeriod(organizationId, start, end),
    ]);

    const projectsUsed = (projects as Project[]).filter((project) =>
      isWithinPeriod(project.createdAt, start, end)
    ).length;
    const documentsUsed = (documents as Document[]).filter((document) =>
      isWithinPeriod(document.uploadedAt, start, end)
    ).length;
    const aiTokensUsed = sumTokens(events);
    const costCents = events.reduce((sum, event) => sum + (event.costCents ?? 0), 0);
    const limits = PLAN_LIMITS[plan];

    return {
      organizationId,
      plan,
      status: subscription.status,
      period: { start, end },
      usage: {
        projects: projectsUsed,
        documents: documentsUsed,
        aiTokens: aiTokensUsed,
        costCents,
        eventsCount: events.length,
      },
      limits,
      percentUsed: {
        projects: usagePercent(projectsUsed, limits.projects),
        documents: usagePercent(documentsUsed, limits.documents),
        aiTokens: usagePercent(aiTokensUsed, limits.aiTokens),
      },
    };
  }

  async checkLimit(
    userId: string,
    limitType: LimitType,
    requestedAmount = 1,
    organizationId?: string
  ): Promise<{ allowed: true; summary: UsageSummary } | { allowed: false; summary: UsageSummary; denial: LimitDenial }> {
    const summary = await this.getUsageSummary(userId, organizationId);
    const used =
      limitType === "projects"
        ? summary.usage.projects
        : limitType === "documents"
          ? summary.usage.documents
          : summary.usage.aiTokens;
    const limit =
      limitType === "projects"
        ? summary.limits.projects
        : limitType === "documents"
          ? summary.limits.documents
          : summary.limits.aiTokens;

    const result = checkUsageAgainstLimit(limitType, summary.plan, used, limit, requestedAmount);
    if (result.allowed) return { allowed: true, summary };
    return { allowed: false, summary, denial: result.denial };
  }

  async recordUsage(event: InsertUsageEvent): Promise<void> {
    await this.store.createUsageEvent({
      provider: "internal",
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      metadata: {},
      ...event,
    });
  }

  formatLimits(summary: UsageSummary) {
    return {
      ...summary,
      currentPeriod: {
        tokensUsed: summary.usage.aiTokens,
        costUsd: summary.usage.costCents / 100,
        eventsCount: summary.usage.eventsCount,
        projectsCreated: summary.usage.projects,
        documentsUploaded: summary.usage.documents,
      },
      limits: {
        ...summary.limits,
        aiCredits: summary.limits.aiTokens,
      },
      percentUsed: {
        ...summary.percentUsed,
        tokens: summary.percentUsed.aiTokens,
      },
      alerts: [],
      allowed: {
        createProject: summary.usage.projects < summary.limits.projects,
        uploadDocument: summary.usage.documents < summary.limits.documents,
        generateDraft: summary.usage.aiTokens < summary.limits.aiTokens,
      },
    };
  }
}

export const billingService = new BillingService();
