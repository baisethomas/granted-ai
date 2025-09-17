import { MODEL_PRICING, type ModelName, type TokenUsage, type CostCalculation } from './types';
import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';

export class TokenTracker {
  private static instance: TokenTracker;
  private supabase: any;

  private constructor() {
    // Use appropriate client based on environment
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  /**
   * Calculate cost for a given model and token usage
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): CostCalculation {
    const modelKey = model as ModelName;
    const pricing = MODEL_PRICING[modelKey];
    
    if (!pricing) {
      console.warn(`Unknown model pricing for ${model}, using default rates`);
      // Default to gpt-4o-mini rates
      const fallbackPricing = MODEL_PRICING['gpt-4o-mini'];
      const inputCost = (inputTokens / 1000) * fallbackPricing.input;
      const outputCost = (outputTokens / 1000) * fallbackPricing.output;
      
      return {
        baseModel: model,
        inputTokens,
        outputTokens,
        inputCostPerToken: fallbackPricing.input / 1000,
        outputCostPerToken: fallbackPricing.output / 1000,
        totalCost: Math.round((inputCost + outputCost) * 100) / 100, // Round to 2 decimal places in cents
      };
    }

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    
    return {
      baseModel: model,
      inputTokens,
      outputTokens,
      inputCostPerToken: pricing.input / 1000,
      outputCostPerToken: pricing.output / 1000,
      totalCost: Math.round((inputCost + outputCost) * 100) / 100, // Round to 2 decimal places in cents
    };
  }

  /**
   * Track token usage for an API call
   */
  async trackUsage({
    organizationId,
    userId,
    projectId,
    type,
    provider,
    model,
    inputTokens,
    outputTokens,
    metadata = {},
  }: {
    organizationId: string;
    userId: string;
    projectId?: string;
    type: 'generation' | 'summarization' | 'embedding' | 'rag_retrieval' | 'clarification' | 'export';
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const costCalc = this.calculateCost(model, inputTokens, outputTokens);
      
      const { error } = await this.supabase
        .from('usage_events')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          project_id: projectId,
          type,
          provider,
          model,
          tokens_in: inputTokens,
          tokens_out: outputTokens,
          cost: Math.round(costCalc.totalCost),
          metadata: {
            ...metadata,
            cost_breakdown: costCalc,
            tracked_at: new Date().toISOString(),
          },
        });

      if (error) {
        console.error('Failed to track usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error tracking token usage:', error);
      return false;
    }
  }

  /**
   * Get current month usage for an organization
   */
  async getCurrentMonthUsage(organizationId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    apiCalls: number;
    breakdown: Record<string, { tokens: number; cost: number; calls: number }>;
  }> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await this.supabase
        .from('usage_events')
        .select('type, tokens_in, tokens_out, cost, model, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error) {
        console.error('Failed to fetch usage data:', error);
        return { totalTokens: 0, totalCost: 0, apiCalls: 0, breakdown: {} };
      }

      const breakdown: Record<string, { tokens: number; cost: number; calls: number }> = {};
      let totalTokens = 0;
      let totalCost = 0;
      let apiCalls = 0;

      for (const event of data || []) {
        const eventTokens = (event.tokens_in || 0) + (event.tokens_out || 0);
        const eventCost = event.cost || 0;
        
        totalTokens += eventTokens;
        totalCost += eventCost;
        apiCalls++;

        if (!breakdown[event.type]) {
          breakdown[event.type] = { tokens: 0, cost: 0, calls: 0 };
        }
        
        breakdown[event.type].tokens += eventTokens;
        breakdown[event.type].cost += eventCost;
        breakdown[event.type].calls++;
      }

      return { totalTokens, totalCost, apiCalls, breakdown };
    } catch (error) {
      console.error('Error fetching current month usage:', error);
      return { totalTokens: 0, totalCost: 0, apiCalls: 0, breakdown: {} };
    }
  }

  /**
   * Get usage analytics for a given time period
   */
  async getUsageAnalytics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    dailyUsage: Array<{ date: string; tokens: number; cost: number; calls: number }>;
    modelBreakdown: Record<string, { tokens: number; cost: number; calls: number }>;
    typeBreakdown: Record<string, { tokens: number; cost: number; calls: number }>;
    totalTokens: number;
    totalCost: number;
    totalCalls: number;
    averageCostPerCall: number;
    peakUsageDay: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('usage_events')
        .select('type, tokens_in, tokens_out, cost, model, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch usage analytics:', error);
        throw new Error('Failed to fetch usage analytics');
      }

      const dailyUsage: Record<string, { tokens: number; cost: number; calls: number }> = {};
      const modelBreakdown: Record<string, { tokens: number; cost: number; calls: number }> = {};
      const typeBreakdown: Record<string, { tokens: number; cost: number; calls: number }> = {};
      let totalTokens = 0;
      let totalCost = 0;
      let totalCalls = 0;

      for (const event of data || []) {
        const eventDate = new Date(event.created_at).toISOString().split('T')[0];
        const eventTokens = (event.tokens_in || 0) + (event.tokens_out || 0);
        const eventCost = event.cost || 0;
        
        // Daily usage
        if (!dailyUsage[eventDate]) {
          dailyUsage[eventDate] = { tokens: 0, cost: 0, calls: 0 };
        }
        dailyUsage[eventDate].tokens += eventTokens;
        dailyUsage[eventDate].cost += eventCost;
        dailyUsage[eventDate].calls++;

        // Model breakdown
        if (!modelBreakdown[event.model]) {
          modelBreakdown[event.model] = { tokens: 0, cost: 0, calls: 0 };
        }
        modelBreakdown[event.model].tokens += eventTokens;
        modelBreakdown[event.model].cost += eventCost;
        modelBreakdown[event.model].calls++;

        // Type breakdown
        if (!typeBreakdown[event.type]) {
          typeBreakdown[event.type] = { tokens: 0, cost: 0, calls: 0 };
        }
        typeBreakdown[event.type].tokens += eventTokens;
        typeBreakdown[event.type].cost += eventCost;
        typeBreakdown[event.type].calls++;

        totalTokens += eventTokens;
        totalCost += eventCost;
        totalCalls++;
      }

      // Find peak usage day
      let peakUsageDay = '';
      let peakUsageTokens = 0;
      for (const [date, usage] of Object.entries(dailyUsage)) {
        if (usage.tokens > peakUsageTokens) {
          peakUsageTokens = usage.tokens;
          peakUsageDay = date;
        }
      }

      return {
        dailyUsage: Object.entries(dailyUsage).map(([date, usage]) => ({
          date,
          ...usage,
        })),
        modelBreakdown,
        typeBreakdown,
        totalTokens,
        totalCost,
        totalCalls,
        averageCostPerCall: totalCalls > 0 ? totalCost / totalCalls : 0,
        peakUsageDay,
      };
    } catch (error) {
      console.error('Error fetching usage analytics:', error);
      throw error;
    }
  }

  /**
   * Track tokens from OpenAI response
   */
  trackOpenAIUsage(response: any): TokenUsage {
    const usage = response.usage;
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    }

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    
    // Estimate cost based on default model
    const costCalc = this.calculateCost('gpt-4o-mini', inputTokens, outputTokens);
    
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costCalc.totalCost,
    };
  }

  /**
   * Track tokens from Anthropic response
   */
  trackAnthropicUsage(response: any): TokenUsage {
    const usage = response.usage;
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      };
    }

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    
    // Estimate cost based on default model
    const costCalc = this.calculateCost('claude-3-5-haiku-latest', inputTokens, outputTokens);
    
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costCalc.totalCost,
    };
  }
}

export const tokenTracker = TokenTracker.getInstance();