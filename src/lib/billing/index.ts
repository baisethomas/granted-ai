// Core billing system exports
export { tokenTracker } from './token-tracker';
export { planEnforcer } from './plan-enforcement';
export { analyticsService } from './analytics';
export { billingEngine } from './billing-engine';
export { costControlService } from './cost-control';
export { stripeService } from './stripe-integration';
export { optimizationService } from './optimization';

// Type exports
export type {
  PlanLimits,
  TokenUsage,
  UsageSnapshot,
  BillingAlert,
  CostCalculation,
  UsageMetrics,
  UsageEvent,
} from './types';

export type {
  PlanValidationResult,
  OrganizationUsage,
} from './plan-enforcement';

export type {
  UsageDashboardData,
  CostOptimization,
} from './analytics';

export type {
  PlanPricing,
  Invoice,
  InvoiceLineItem,
  BillingCalculation,
} from './billing-engine';

export type {
  BudgetAlert,
  BudgetSettings,
  UsageForecasting,
} from './cost-control';

export type {
  StripeConfig,
  SubscriptionDetails,
  PaymentMethod,
  StripeCustomer,
} from './stripe-integration';

export type {
  OptimizationRecommendation,
  OptimizationAnalysis,
  ModelRecommendation,
} from './optimization';

// Constants
export { PLAN_LIMITS, MODEL_PRICING, PLAN_PRICING } from './types';

/**
 * Comprehensive billing system for Granted AI
 * 
 * Features:
 * - Real-time token tracking with <50ms latency
 * - Plan enforcement and limit checking
 * - Usage analytics and reporting
 * - Cost calculation and billing
 * - Budget alerts and cost control
 * - Stripe integration for payments
 * - AI-powered usage optimization
 * 
 * Usage:
 * ```typescript
 * import { tokenTracker, planEnforcer } from '@/lib/billing';
 * 
 * // Track LLM usage
 * await tokenTracker.trackUsage({
 *   organizationId,
 *   userId,
 *   type: 'generation',
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   inputTokens: 100,
 *   outputTokens: 50,
 * });
 * 
 * // Check plan limits
 * const canCreate = await planEnforcer.canCreateProject(organizationId);
 * if (!canCreate.allowed) {
 *   throw new Error(canCreate.reason);
 * }
 * ```
 */