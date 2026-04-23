import { storage } from "../storage.js";
import type { GrantMetric } from "@shared/schema";

export type MetricType = "number" | "currency" | "percent" | "text" | "date";
export type MetricCategory =
  | "impact"
  | "financial"
  | "timeline"
  | "reporting"
  | "custom";
export type MetricSource = "manual" | "ai_suggested" | "preset";
export type MetricStatus = "suggested" | "active" | "dismissed";

export interface MetricPreset {
  key: string;
  label: string;
  type: MetricType;
  unit?: string;
  category: MetricCategory;
  description?: string;
}

// Curated preset catalog for the "Add metric" dropdown and for the
// mock-extraction fallback when no AI key is configured.
export const METRIC_PRESETS: MetricPreset[] = [
  // Impact
  { key: "people_served", label: "People served", type: "number", unit: "people", category: "impact" },
  { key: "beneficiaries_reached", label: "Beneficiaries reached", type: "number", unit: "people", category: "impact" },
  { key: "jobs_created", label: "Jobs created", type: "number", unit: "jobs", category: "impact" },
  { key: "volunteer_hours", label: "Volunteer hours", type: "number", unit: "hours", category: "impact" },
  { key: "services_delivered", label: "Services delivered", type: "number", category: "impact" },

  // Financial
  { key: "amount_requested", label: "Amount requested", type: "currency", category: "financial" },
  { key: "amount_awarded", label: "Amount awarded", type: "currency", category: "financial" },
  { key: "amount_disbursed", label: "Amount disbursed", type: "currency", category: "financial" },
  { key: "match_funds_secured", label: "Match funds secured", type: "currency", category: "financial" },
  { key: "cost_per_beneficiary", label: "Cost per beneficiary", type: "currency", category: "financial" },

  // Timeline / reporting
  { key: "project_start", label: "Project start date", type: "date", category: "timeline" },
  { key: "project_end", label: "Project end date", type: "date", category: "timeline" },
  { key: "reporting_due", label: "Reporting due date", type: "date", category: "reporting" },
  { key: "milestone_1", label: "Milestone 1", type: "date", category: "timeline" },
  { key: "milestone_2", label: "Milestone 2", type: "date", category: "timeline" },
  { key: "milestone_3", label: "Milestone 3", type: "date", category: "timeline" },
];

export function getPreset(key: string): MetricPreset | undefined {
  return METRIC_PRESETS.find(p => p.key === key);
}

export interface ApplicationMetrics {
  completionPct: number;
  questionsTotal: number;
  questionsAnswered: number;
  citationsCount: number;
  unresolvedAssumptions: number;
  daysToDeadline: number | null;
  wordLimitUtilization: number | null; // 0-1 across questions with limits
  lastActivityAt: string | null;
}

// Computes live application-progress metrics from existing data.
// No persistence — this is a derived view surfaced alongside grant_metrics.
export async function computeApplicationMetrics(
  projectId: string,
): Promise<ApplicationMetrics> {
  const project = await storage.getProject(projectId);
  const questions = await storage.getGrantQuestions(projectId);

  const questionsTotal = questions.length;
  const questionsAnswered = questions.filter(
    q => q.response && q.response.trim().length > 0,
  ).length;
  const completionPct =
    questionsTotal === 0 ? 0 : Math.round((questionsAnswered / questionsTotal) * 100);

  let citationsCount = 0;
  for (const q of questions) {
    const citations = await storage.getDraftCitations(q.id);
    citationsCount += citations.length;
  }

  const assumptions = await storage.getAssumptionLabels(projectId);
  const unresolvedAssumptions = assumptions.filter(a => !a.resolved).length;

  const daysToDeadline = project?.deadline
    ? Math.ceil(
        (new Date(project.deadline).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const withLimits = questions.filter(q => q.wordLimit && q.response);
  const wordLimitUtilization =
    withLimits.length === 0
      ? null
      : withLimits.reduce((sum, q) => {
          const words = (q.response ?? "").trim().split(/\s+/).filter(Boolean).length;
          const limit = q.wordLimit ?? 1;
          return sum + Math.min(1, words / limit);
        }, 0) / withLimits.length;

  // Use most recent question createdAt as a proxy for activity.
  const latest = questions
    .map(q => q.createdAt ? new Date(q.createdAt).getTime() : 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const lastActivityAt = latest ? new Date(latest).toISOString() : null;

  return {
    completionPct,
    questionsTotal,
    questionsAnswered,
    citationsCount,
    unresolvedAssumptions,
    daysToDeadline,
    wordLimitUtilization,
    lastActivityAt,
  };
}

export function groupMetrics(metrics: GrantMetric[]): Record<MetricCategory, GrantMetric[]> {
  const groups: Record<MetricCategory, GrantMetric[]> = {
    impact: [],
    financial: [],
    timeline: [],
    reporting: [],
    custom: [],
  };
  for (const m of metrics) {
    const cat = (m.category as MetricCategory) in groups
      ? (m.category as MetricCategory)
      : "custom";
    groups[cat].push(m);
  }
  return groups;
}
