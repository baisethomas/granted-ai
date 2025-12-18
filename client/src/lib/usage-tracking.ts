import { getAuthHeaders } from "./queryClient";

export interface UsageEvent {
  organizationId: number;
  userId?: number;
  projectId?: number;
  eventType: 'generation' | 'embedding' | 'clarification' | 'export' | 'upload';
  provider: 'openai' | 'anthropic' | 'internal';
  model?: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  processingTimeMs?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface PlanLimits {
  projects: number;
  documents: number;
  aiCredits: number; // Token limit per month
  teamMembers: number;
}

export interface UsageStats {
  currentPeriod: {
    tokensUsed: number;
    costUsd: number;
    eventsCount: number;
    projectsCreated: number;
    documentsUploaded: number;
  };
  limits: PlanLimits;
  percentUsed: {
    tokens: number;
    projects: number;
    documents: number;
  };
  alerts: Array<{
    type: 'threshold_50' | 'threshold_80' | 'threshold_100' | 'spike_detected';
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }>;
}

export class UsageTracker {
  private static readonly API_BASE = '/api/billing';

  /**
   * Track a usage event
   */
  static async trackUsage(event: Partial<UsageEvent>): Promise<void> {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(`${this.API_BASE}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'track',
          event: {
            eventType: 'generation',
            provider: 'openai',
            tokensInput: 0,
            tokensOutput: 0,
            costUsd: 0,
            success: true,
            ...event
          }
        })
      });
    } catch (error) {
      console.error('Failed to track usage:', error);
      // Don't throw - usage tracking failure shouldn't break the app
    }
  }

  /**
   * Check if organization can perform an action within plan limits
   */
  static async checkLimits(
    organizationId: number, 
    limitType: 'projects' | 'documents' | 'ai_credits' | 'team_members',
    requestedAmount: number = 1
  ): Promise<{ allowed: boolean; reason?: string; usage?: any }> {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${this.API_BASE}/limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          organizationId,
          limitType,
          requestedAmount
        })
      });

      if (!response.ok) {
        return { allowed: false, reason: 'Failed to check limits' };
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to check limits:', error);
      return { allowed: true }; // Fail open to avoid breaking the app
    }
  }

  /**
   * Get current usage statistics
   */
  static async getUsageStats(organizationId: number): Promise<UsageStats | null> {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${this.API_BASE}/usage?organizationId=${organizationId}`, {
        headers: authHeaders,
      });
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }

  /**
   * Calculate estimated cost for tokens
   */
  static calculateCost(provider: string, model: string, tokensInput: number, tokensOutput: number): number {
    const pricing = {
      openai: {
        'gpt-4': { input: 0.00003, output: 0.00006 }, // $0.03/$0.06 per 1K tokens
        'gpt-4o': { input: 0.00001, output: 0.00003 }, // $0.01/$0.03 per 1K tokens  
        'text-embedding-3-small': { input: 0.00002, output: 0 } // $0.02 per 1K tokens
      },
      anthropic: {
        'claude-3-sonnet': { input: 0.000003, output: 0.000015 }, // $3/$15 per 1M tokens
        'claude-3-haiku': { input: 0.00000025, output: 0.00000125 } // $0.25/$1.25 per 1M tokens
      }
    };

    const providerPricing = pricing[provider as keyof typeof pricing];
    if (!providerPricing) return 0;

    const modelPricing = providerPricing[model as keyof typeof providerPricing];
    if (!modelPricing) return 0;

    return (tokensInput * modelPricing.input) + (tokensOutput * modelPricing.output);
  }

  /**
   * Track AI generation usage
   */
  static async trackGeneration(
    organizationId: number,
    questionId: string,
    provider: string,
    model: string,
    tokensInput: number,
    tokensOutput: number,
    processingTimeMs: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const cost = this.calculateCost(provider, model, tokensInput, tokensOutput);
    
    await this.trackUsage({
      organizationId,
      eventType: 'generation',
      provider: provider as any,
      model,
      tokensInput,
      tokensOutput,
      costUsd: cost,
      processingTimeMs,
      success,
      errorMessage,
      metadata: { questionId }
    });
  }

  /**
   * Track embedding generation usage
   */
  static async trackEmbedding(
    organizationId: number,
    documentId: number,
    provider: string,
    tokensUsed: number,
    success: boolean
  ): Promise<void> {
    const cost = this.calculateCost(provider, 'text-embedding-3-small', tokensUsed, 0);
    
    await this.trackUsage({
      organizationId,
      eventType: 'embedding',
      provider: provider as any,
      model: 'text-embedding-3-small',
      tokensInput: tokensUsed,
      tokensOutput: 0,
      costUsd: cost,
      success,
      metadata: { documentId }
    });
  }

  /**
   * Track export usage (no tokens, but track activity)
   */
  static async trackExport(
    organizationId: number,
    projectId: number,
    exportFormat: string,
    success: boolean
  ): Promise<void> {
    await this.trackUsage({
      organizationId,
      projectId,
      eventType: 'export',
      provider: 'internal',
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      success,
      metadata: { exportFormat }
    });
  }

  /**
   * Get usage optimization recommendations
   */
  static async getOptimizationRecommendations(organizationId: number): Promise<Array<{
    type: string;
    title: string;
    description: string;
    potentialSavings: number;
    effort: string;
    priority: number;
  }> | null> {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${this.API_BASE}/optimization?organizationId=${organizationId}`, {
        headers: authHeaders,
      });
      
      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get optimization recommendations:', error);
      return null;
    }
  }
}

export default UsageTracker;
