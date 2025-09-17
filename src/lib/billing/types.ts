export interface PlanLimits {
  projects: number;
  documents: number;
  documentsPerMonth: number;
  aiCredits: number; // AI credits per month
  teamMembers: number;
  apiCallsPerMinute: number;
  maxTokensPerRequest: number;
  retentionDays: number;
  prioritySupport: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    projects: 3,
    documents: 25,
    documentsPerMonth: 25,
    aiCredits: 100000, // 100k tokens worth
    teamMembers: 1,
    apiCallsPerMinute: 10,
    maxTokensPerRequest: 4000,
    retentionDays: 30,
    prioritySupport: false,
  },
  pro: {
    projects: 15,
    documents: 200,
    documentsPerMonth: 100,
    aiCredits: 1000000, // 1M tokens worth
    teamMembers: 5,
    apiCallsPerMinute: 30,
    maxTokensPerRequest: 8000,
    retentionDays: 90,
    prioritySupport: true,
  },
  team: {
    projects: 50,
    documents: 1000,
    documentsPerMonth: 500,
    aiCredits: 5000000, // 5M tokens worth
    teamMembers: 25,
    apiCallsPerMinute: 60,
    maxTokensPerRequest: 16000,
    retentionDays: 180,
    prioritySupport: true,
  },
  enterprise: {
    projects: -1, // unlimited
    documents: -1, // unlimited
    documentsPerMonth: -1, // unlimited
    aiCredits: -1, // unlimited
    teamMembers: -1, // unlimited
    apiCallsPerMinute: 120,
    maxTokensPerRequest: 32000,
    retentionDays: 365,
    prioritySupport: true,
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // in cents
}

export interface UsageSnapshot {
  organizationId: string;
  period: string; // YYYY-MM format
  projectsCreated: number;
  documentsUploaded: number;
  tokensUsed: number;
  estimatedCost: number; // in cents
  aiCreditsUsed: number;
  apiCalls: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingAlert {
  id: string;
  organizationId: string;
  type: 'budget_warning' | 'limit_reached' | 'overage';
  threshold: number; // percentage (50, 80, 100)
  currentUsage: number;
  limit: number;
  message: string;
  resolved: boolean;
  createdAt: Date;
}

export interface CostCalculation {
  baseModel: string;
  inputTokens: number;
  outputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  totalCost: number; // in cents
}

export interface UsageMetrics {
  totalTokens: number;
  totalCost: number; // in cents
  apiCalls: number;
  averageTokensPerCall: number;
  peakUsageHour: number;
  costPerProject: number;
  efficiencyScore: number; // 0-100 based on cost per output quality
}

// LLM Provider pricing (in cents per 1000 tokens)
export const MODEL_PRICING = {
  'gpt-4o': {
    input: 0.25, // $0.0025 per 1k tokens
    output: 1.0, // $0.01 per 1k tokens
  },
  'gpt-4o-mini': {
    input: 0.015, // $0.00015 per 1k tokens
    output: 0.06, // $0.0006 per 1k tokens
  },
  'gpt-3.5-turbo': {
    input: 0.05, // $0.0005 per 1k tokens
    output: 0.15, // $0.0015 per 1k tokens
  },
  'claude-3-5-sonnet-latest': {
    input: 0.3, // $0.003 per 1k tokens
    output: 1.5, // $0.015 per 1k tokens
  },
  'claude-3-5-haiku-latest': {
    input: 0.1, // $0.001 per 1k tokens
    output: 0.5, // $0.005 per 1k tokens
  },
  'text-embedding-3-small': {
    input: 0.002, // $0.00002 per 1k tokens
    output: 0, // no output cost for embeddings
  },
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

export interface UsageEvent {
  id: string;
  organizationId: string;
  userId: string;
  projectId?: string;
  type: 'generation' | 'summarization' | 'embedding' | 'rag_retrieval' | 'clarification' | 'export';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number; // in cents
  metadata?: Record<string, any>;
  createdAt: Date;
}