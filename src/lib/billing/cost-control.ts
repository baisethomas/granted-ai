import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';
import { planEnforcer } from './plan-enforcement';
import { billingEngine } from './billing-engine';
import { PLAN_LIMITS } from './types';

export interface BudgetAlert {
  id: string;
  organizationId: string;
  type: 'budget_warning' | 'budget_exceeded' | 'usage_spike' | 'inefficient_usage' | 'plan_upgrade_needed';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  threshold?: number;
  currentValue: number;
  recommendations: string[];
  triggered: boolean;
  acknowledgedAt?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface BudgetSettings {
  organizationId: string;
  monthlyBudget?: number; // in cents
  alertThresholds: {
    warning: number; // percentage (e.g., 80)
    critical: number; // percentage (e.g., 95)
  };
  spikeDetection: {
    enabled: boolean;
    threshold: number; // percentage increase (e.g., 200 for 200% spike)
  };
  emailAlerts: boolean;
  slackWebhook?: string;
  autoLimits: {
    enabled: boolean;
    pauseAt: number; // percentage (e.g., 100 to pause at budget)
  };
}

export interface UsageForecasting {
  currentUsage: number; // tokens this month so far
  projectedMonthly: number; // projected end of month usage
  confidence: number; // 0-100 confidence in projection
  trend: 'increasing' | 'decreasing' | 'stable';
  projectedCost: number; // in cents
  daysUntilBudgetExceeded?: number;
}

export class CostControlService {
  private static instance: CostControlService;
  private supabase: any;

  private constructor() {
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): CostControlService {
    if (!CostControlService.instance) {
      CostControlService.instance = new CostControlService();
    }
    return CostControlService.instance;
  }

  /**
   * Set budget settings for an organization
   */
  async setBudgetSettings(organizationId: string, settings: Partial<BudgetSettings>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('budget_settings')
        .upsert({
          organization_id: organizationId,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to set budget settings:', error);
        throw new Error('Failed to set budget settings');
      }
    } catch (error) {
      console.error('Error setting budget settings:', error);
      throw error;
    }
  }

  /**
   * Get budget settings for an organization
   */
  async getBudgetSettings(organizationId: string): Promise<BudgetSettings | null> {
    try {
      const { data, error } = await this.supabase
        .from('budget_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to get budget settings:', error);
        return null;
      }

      if (!data) {
        // Return default settings
        return {
          organizationId,
          alertThresholds: {
            warning: 80,
            critical: 95,
          },
          spikeDetection: {
            enabled: true,
            threshold: 200,
          },
          emailAlerts: true,
          autoLimits: {
            enabled: false,
            pauseAt: 100,
          },
        };
      }

      return data;
    } catch (error) {
      console.error('Error getting budget settings:', error);
      return null;
    }
  }

  /**
   * Check and generate alerts for an organization
   */
  async checkAndGenerateAlerts(organizationId: string): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];

    try {
      const [usage, budgetSettings, billing] = await Promise.all([
        planEnforcer.getOrganizationUsage(organizationId),
        this.getBudgetSettings(organizationId),
        billingEngine.calculateBilling(organizationId),
      ]);

      if (!usage || !budgetSettings) {
        return alerts;
      }

      const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;

      // Budget alerts
      if (budgetSettings.monthlyBudget) {
        const currentSpend = billing.subtotal;
        const budgetPercentage = (currentSpend / budgetSettings.monthlyBudget) * 100;

        if (budgetPercentage >= budgetSettings.alertThresholds.critical) {
          alerts.push({
            id: `budget_critical_${organizationId}`,
            organizationId,
            type: 'budget_exceeded',
            severity: 'critical',
            title: 'Budget Critical Alert',
            message: `You've used ${budgetPercentage.toFixed(1)}% of your monthly budget`,
            threshold: budgetSettings.alertThresholds.critical,
            currentValue: budgetPercentage,
            recommendations: [
              'Consider upgrading to a higher plan',
              'Review and optimize AI model usage',
              'Set automatic spending limits',
            ],
            triggered: true,
            createdAt: new Date(),
            metadata: {
              currentSpend,
              budget: budgetSettings.monthlyBudget,
            },
          });
        } else if (budgetPercentage >= budgetSettings.alertThresholds.warning) {
          alerts.push({
            id: `budget_warning_${organizationId}`,
            organizationId,
            type: 'budget_warning',
            severity: 'warning',
            title: 'Budget Warning',
            message: `You've used ${budgetPercentage.toFixed(1)}% of your monthly budget`,
            threshold: budgetSettings.alertThresholds.warning,
            currentValue: budgetPercentage,
            recommendations: [
              'Monitor usage closely for the rest of the month',
              'Consider optimizing model choices for routine tasks',
            ],
            triggered: true,
            createdAt: new Date(),
            metadata: {
              currentSpend,
              budget: budgetSettings.monthlyBudget,
            },
          });
        }
      }

      // Usage limit alerts
      if (limits.aiCredits !== -1) {
        const creditsPercentage = (usage.tokensThisMonth / limits.aiCredits) * 100;
        
        if (creditsPercentage >= 95) {
          alerts.push({
            id: `credits_critical_${organizationId}`,
            organizationId,
            type: 'budget_exceeded',
            severity: 'critical',
            title: 'AI Credits Nearly Exhausted',
            message: `You've used ${creditsPercentage.toFixed(1)}% of your AI credits`,
            currentValue: creditsPercentage,
            recommendations: [
              'Upgrade to a plan with more AI credits',
              'Switch to more efficient models for routine tasks',
            ],
            triggered: true,
            createdAt: new Date(),
          });
        } else if (creditsPercentage >= 80) {
          alerts.push({
            id: `credits_warning_${organizationId}`,
            organizationId,
            type: 'budget_warning',
            severity: 'warning',
            title: 'AI Credits Running Low',
            message: `You've used ${creditsPercentage.toFixed(1)}% of your AI credits`,
            currentValue: creditsPercentage,
            recommendations: [
              'Monitor AI credit usage',
              'Consider switching to GPT-4o Mini for cost savings',
            ],
            triggered: true,
            createdAt: new Date(),
          });
        }
      }

      // Usage spike detection
      if (budgetSettings.spikeDetection.enabled) {
        const spike = await this.detectUsageSpike(organizationId, budgetSettings.spikeDetection.threshold);
        if (spike) {
          alerts.push({
            id: `usage_spike_${organizationId}`,
            organizationId,
            type: 'usage_spike',
            severity: 'warning',
            title: 'Unusual Usage Spike Detected',
            message: `Usage increased by ${spike.percentageIncrease.toFixed(1)}% compared to previous period`,
            currentValue: spike.currentUsage,
            recommendations: [
              'Review recent API activity',
              'Check for any automation or bulk processing',
              'Verify usage patterns are intended',
            ],
            triggered: true,
            createdAt: new Date(),
            metadata: spike,
          });
        }
      }

      // Inefficient usage detection
      const inefficiency = await this.detectInefficiency(organizationId);
      if (inefficiency) {
        alerts.push({
          id: `inefficient_usage_${organizationId}`,
          organizationId,
          type: 'inefficient_usage',
          severity: 'info',
          title: 'Optimization Opportunity Detected',
          message: inefficiency.message,
          currentValue: inefficiency.wastedCost,
          recommendations: inefficiency.recommendations,
          triggered: true,
          createdAt: new Date(),
          metadata: inefficiency.details,
        });
      }

    } catch (error) {
      console.error('Error checking alerts:', error);
    }

    return alerts;
  }

  /**
   * Detect usage spikes
   */
  private async detectUsageSpike(organizationId: string, thresholdPercentage: number): Promise<{
    currentUsage: number;
    previousUsage: number;
    percentageIncrease: number;
  } | null> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Get current week usage
      const { data: currentWeek, error: currentError } = await this.supabase
        .from('usage_events')
        .select('tokens_in, tokens_out, cost')
        .eq('organization_id', organizationId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .lte('created_at', now.toISOString());

      // Get previous week usage
      const { data: previousWeek, error: previousError } = await this.supabase
        .from('usage_events')
        .select('tokens_in, tokens_out, cost')
        .eq('organization_id', organizationId)
        .gte('created_at', fourteenDaysAgo.toISOString())
        .lt('created_at', sevenDaysAgo.toISOString());

      if (currentError || previousError || !currentWeek || !previousWeek) {
        return null;
      }

      const currentUsage = currentWeek.reduce((sum, event) => 
        sum + (event.tokens_in || 0) + (event.tokens_out || 0), 0
      );
      const previousUsage = previousWeek.reduce((sum, event) => 
        sum + (event.tokens_in || 0) + (event.tokens_out || 0), 0
      );

      if (previousUsage === 0 || currentUsage <= previousUsage) {
        return null;
      }

      const percentageIncrease = ((currentUsage - previousUsage) / previousUsage) * 100;

      if (percentageIncrease >= thresholdPercentage) {
        return {
          currentUsage,
          previousUsage,
          percentageIncrease,
        };
      }

      return null;
    } catch (error) {
      console.error('Error detecting usage spike:', error);
      return null;
    }
  }

  /**
   * Detect inefficient usage patterns
   */
  private async detectInefficiency(organizationId: string): Promise<{
    message: string;
    wastedCost: number;
    recommendations: string[];
    details: Record<string, any>;
  } | null> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      const { data: events, error } = await this.supabase
        .from('usage_events')
        .select('model, tokens_in, tokens_out, cost, type')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error || !events || events.length === 0) {
        return null;
      }

      // Check for expensive model usage for simple tasks
      const summaryEvents = events.filter(e => e.type === 'summarization');
      const expensiveSummaries = summaryEvents.filter(e => 
        e.model?.includes('gpt-4') || e.model?.includes('claude-3-5-sonnet')
      );

      if (expensiveSummaries.length > 0 && expensiveSummaries.length / summaryEvents.length > 0.5) {
        const wastedCost = expensiveSummaries.reduce((sum, e) => sum + (e.cost || 0), 0) * 0.8; // 80% could be saved
        
        return {
          message: 'Using expensive models for document summarization',
          wastedCost,
          recommendations: [
            'Switch to GPT-4o Mini for document summarization',
            'Reserve premium models for complex generation tasks',
            'Set model preferences in organization settings',
          ],
          details: {
            expensiveUsage: expensiveSummaries.length,
            totalSummaries: summaryEvents.length,
            potentialSavings: wastedCost,
          },
        };
      }

      // Check for high token usage with low output quality (could indicate inefficient prompts)
      const highTokenEvents = events.filter(e => (e.tokens_in || 0) > 3000);
      const avgCostPerToken = events.reduce((sum, e) => sum + (e.cost || 0), 0) / 
        events.reduce((sum, e) => sum + (e.tokens_in || 0) + (e.tokens_out || 0), 0);

      if (highTokenEvents.length > events.length * 0.3 && avgCostPerToken > 0.001) {
        return {
          message: 'High token usage detected - prompts may be inefficient',
          wastedCost: Math.round(avgCostPerToken * 1000 * highTokenEvents.length * 0.3),
          recommendations: [
            'Optimize prompt length and context',
            'Use more focused document chunks',
            'Remove unnecessary context from AI requests',
          ],
          details: {
            highTokenEvents: highTokenEvents.length,
            avgTokensPerCall: events.reduce((sum, e) => sum + (e.tokens_in || 0), 0) / events.length,
          },
        };
      }

      return null;
    } catch (error) {
      console.error('Error detecting inefficiency:', error);
      return null;
    }
  }

  /**
   * Generate usage forecasting
   */
  async generateForecast(organizationId: string): Promise<UsageForecasting | null> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysElapsed = Math.ceil((now.getTime() - startOfMonth.getTime()) / (24 * 60 * 60 * 1000));
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      // Get current month usage
      const { data: currentMonth, error } = await this.supabase
        .from('usage_events')
        .select('tokens_in, tokens_out, cost, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error || !currentMonth || currentMonth.length === 0) {
        return null;
      }

      const currentUsage = currentMonth.reduce((sum, event) => 
        sum + (event.tokens_in || 0) + (event.tokens_out || 0), 0
      );

      const currentCost = currentMonth.reduce((sum, event) => sum + (event.cost || 0), 0);

      // Calculate daily averages and trend
      const dailyUsage: Record<string, number> = {};
      currentMonth.forEach(event => {
        const day = event.created_at.split('T')[0];
        dailyUsage[day] = (dailyUsage[day] || 0) + (event.tokens_in || 0) + (event.tokens_out || 0);
      });

      const dailyValues = Object.values(dailyUsage);
      const avgDailyUsage = currentUsage / Math.max(daysElapsed, 1);

      // Simple linear trend calculation
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (dailyValues.length >= 3) {
        const recentAvg = dailyValues.slice(-3).reduce((a, b) => a + b) / 3;
        const earlierAvg = dailyValues.slice(0, 3).reduce((a, b) => a + b) / 3;
        
        if (recentAvg > earlierAvg * 1.2) trend = 'increasing';
        else if (recentAvg < earlierAvg * 0.8) trend = 'decreasing';
      }

      // Project usage
      let projectedMonthly = avgDailyUsage * daysInMonth;
      let confidence = Math.min(90, Math.max(30, daysElapsed * 3)); // More confidence as month progresses

      // Adjust projection based on trend
      if (trend === 'increasing') {
        projectedMonthly *= 1.3; // 30% increase
        confidence = Math.max(confidence - 10, 30);
      } else if (trend === 'decreasing') {
        projectedMonthly *= 0.8; // 20% decrease
        confidence = Math.max(confidence - 5, 30);
      }

      const projectedCost = Math.round((currentCost / currentUsage) * projectedMonthly);

      // Calculate days until budget exceeded
      const budgetSettings = await this.getBudgetSettings(organizationId);
      let daysUntilBudgetExceeded: number | undefined;
      
      if (budgetSettings?.monthlyBudget && currentCost > 0) {
        const dailyCostRate = currentCost / daysElapsed;
        const remainingBudget = budgetSettings.monthlyBudget - currentCost;
        
        if (dailyCostRate > 0 && remainingBudget > 0) {
          daysUntilBudgetExceeded = Math.ceil(remainingBudget / dailyCostRate);
        }
      }

      return {
        currentUsage,
        projectedMonthly: Math.round(projectedMonthly),
        confidence,
        trend,
        projectedCost,
        daysUntilBudgetExceeded,
      };
    } catch (error) {
      console.error('Error generating forecast:', error);
      return null;
    }
  }

  /**
   * Get organization spending dashboard
   */
  async getSpendingDashboard(organizationId: string): Promise<{
    currentMonth: {
      spend: number;
      budget?: number;
      percentage?: number;
    };
    forecast: UsageForecasting | null;
    alerts: BudgetAlert[];
    recommendations: Array<{
      title: string;
      description: string;
      potentialSavings: number;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    const [billing, forecast, alerts] = await Promise.all([
      billingEngine.calculateBilling(organizationId),
      this.generateForecast(organizationId),
      this.checkAndGenerateAlerts(organizationId),
    ]);

    const budgetSettings = await this.getBudgetSettings(organizationId);
    
    const currentMonth = {
      spend: billing.subtotal,
      budget: budgetSettings?.monthlyBudget,
      percentage: budgetSettings?.monthlyBudget 
        ? Math.round((billing.subtotal / budgetSettings.monthlyBudget) * 100)
        : undefined,
    };

    // Generate cost-saving recommendations
    const recommendations = await this.generateRecommendations(organizationId);

    return {
      currentMonth,
      forecast,
      alerts,
      recommendations,
    };
  }

  /**
   * Generate cost-saving recommendations
   */
  private async generateRecommendations(organizationId: string): Promise<Array<{
    title: string;
    description: string;
    potentialSavings: number;
    priority: 'high' | 'medium' | 'low';
  }>> {
    const recommendations: Array<{
      title: string;
      description: string;
      potentialSavings: number;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    try {
      const [usage, inefficiency] = await Promise.all([
        planEnforcer.getOrganizationUsage(organizationId),
        this.detectInefficiency(organizationId),
      ]);

      if (!usage) return recommendations;

      // Plan optimization
      const limits = PLAN_LIMITS[usage.currentPlan];
      if (usage.tokensThisMonth < limits.aiCredits * 0.3 && usage.currentPlan !== 'starter') {
        recommendations.push({
          title: 'Consider downgrading your plan',
          description: `You're using only ${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}% of your AI credits`,
          potentialSavings: 0, // Would need billing amounts
          priority: 'medium',
        });
      }

      // Model optimization
      if (inefficiency?.message.includes('expensive models')) {
        recommendations.push({
          title: 'Optimize AI model usage',
          description: inefficiency.message,
          potentialSavings: inefficiency.wastedCost,
          priority: 'high',
        });
      }

      // Usage efficiency
      if (inefficiency?.message.includes('High token usage')) {
        recommendations.push({
          title: 'Optimize prompt efficiency',
          description: 'Reduce context size and prompt length for better cost efficiency',
          potentialSavings: inefficiency.wastedCost,
          priority: 'medium',
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return recommendations;
    }
  }
}

export const costControlService = CostControlService.getInstance();