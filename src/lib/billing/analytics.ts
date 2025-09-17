import { tokenTracker } from './token-tracker';
import { planEnforcer } from './plan-enforcement';
import { PLAN_LIMITS, type UsageMetrics } from './types';
import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';

export interface UsageDashboardData {
  currentUsage: {
    projects: { current: number; limit: number; percentage: number };
    documents: { current: number; limit: number; percentage: number };
    tokens: { current: number; limit: number; percentage: number };
    cost: { current: number; budget?: number; percentage?: number };
    teamMembers: { current: number; limit: number; percentage: number };
  };
  trends: {
    dailyUsage: Array<{
      date: string;
      tokens: number;
      cost: number;
      calls: number;
    }>;
    weeklyGrowth: number;
    monthlyProjection: number;
  };
  breakdown: {
    byType: Record<string, { tokens: number; cost: number; calls: number }>;
    byModel: Record<string, { tokens: number; cost: number; calls: number }>;
    byProject: Array<{ projectId: string; projectTitle: string; tokens: number; cost: number }>;
  };
  efficiency: {
    avgTokensPerCall: number;
    avgCostPerProject: number;
    costPerToken: number;
    peakUsageHours: Array<{ hour: number; tokens: number }>;
  };
  alerts: Array<{
    type: 'warning' | 'danger' | 'info';
    message: string;
    action?: string;
  }>;
}

export interface CostOptimization {
  potentialSavings: number; // in cents
  recommendations: Array<{
    type: 'model_optimization' | 'usage_pattern' | 'plan_adjustment';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    savingsEstimate: number; // in cents per month
    implementation: string;
  }>;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private supabase: any;

  private constructor() {
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Get comprehensive usage dashboard data
   */
  async getDashboardData(organizationId: string): Promise<UsageDashboardData> {
    const [usage, analytics] = await Promise.all([
      planEnforcer.getOrganizationUsage(organizationId),
      this.getUsageAnalytics(organizationId),
    ]);

    if (!usage) {
      throw new Error('Failed to fetch organization usage');
    }

    const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;
    
    // Current usage percentages
    const currentUsage = {
      projects: {
        current: usage.projectsCount,
        limit: limits.projects,
        percentage: planEnforcer.getUsagePercentage(usage.projectsCount, limits.projects),
      },
      documents: {
        current: usage.documentsCount,
        limit: limits.documents,
        percentage: planEnforcer.getUsagePercentage(usage.documentsCount, limits.documents),
      },
      tokens: {
        current: usage.tokensThisMonth,
        limit: limits.aiCredits,
        percentage: planEnforcer.getUsagePercentage(usage.tokensThisMonth, limits.aiCredits),
      },
      cost: {
        current: analytics.totalCost,
        percentage: 0, // Will be calculated if budget is set
      },
      teamMembers: {
        current: usage.teamMembersCount,
        limit: limits.teamMembers,
        percentage: planEnforcer.getUsagePercentage(usage.teamMembersCount, limits.teamMembers),
      },
    };

    // Calculate trends
    const weeklyGrowth = await this.calculateWeeklyGrowth(organizationId);
    const monthlyProjection = this.calculateMonthlyProjection(analytics.dailyUsage);

    // Get project breakdown
    const projectBreakdown = await this.getProjectBreakdown(organizationId);

    // Generate alerts
    const alerts = this.generateAlerts(currentUsage, usage.currentPlan);

    return {
      currentUsage,
      trends: {
        dailyUsage: analytics.dailyUsage,
        weeklyGrowth,
        monthlyProjection,
      },
      breakdown: {
        byType: analytics.typeBreakdown,
        byModel: analytics.modelBreakdown,
        byProject: projectBreakdown,
      },
      efficiency: {
        avgTokensPerCall: analytics.averageTokensPerCall,
        avgCostPerProject: analytics.averageCostPerProject,
        costPerToken: analytics.totalTokens > 0 ? analytics.totalCost / analytics.totalTokens : 0,
        peakUsageHours: await this.getPeakUsageHours(organizationId),
      },
      alerts,
    };
  }

  /**
   * Get usage analytics for a time period
   */
  private async getUsageAnalytics(organizationId: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(1); // Start of current month
    
    const analytics = await tokenTracker.getUsageAnalytics(organizationId, startDate, endDate);
    
    // Add project cost averages
    const projectCosts = await this.getProjectCosts(organizationId);
    const averageCostPerProject = projectCosts.length > 0 
      ? projectCosts.reduce((sum, p) => sum + p.cost, 0) / projectCosts.length
      : 0;

    return {
      ...analytics,
      averageTokensPerCall: analytics.totalCalls > 0 ? analytics.totalTokens / analytics.totalCalls : 0,
      averageCostPerProject,
    };
  }

  /**
   * Calculate weekly growth rate
   */
  private async calculateWeeklyGrowth(organizationId: string): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

    try {
      const { data, error } = await this.supabase
        .from('usage_events')
        .select('created_at, tokens_in, tokens_out')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error || !data) {
        return 0;
      }

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      let thisWeekTokens = 0;
      let lastWeekTokens = 0;

      data.forEach(event => {
        const eventDate = new Date(event.created_at);
        const tokens = (event.tokens_in || 0) + (event.tokens_out || 0);
        
        if (eventDate >= oneWeekAgo) {
          thisWeekTokens += tokens;
        } else {
          lastWeekTokens += tokens;
        }
      });

      if (lastWeekTokens === 0) return 0;
      return ((thisWeekTokens - lastWeekTokens) / lastWeekTokens) * 100;
    } catch (error) {
      console.error('Error calculating weekly growth:', error);
      return 0;
    }
  }

  /**
   * Calculate monthly projection based on current usage
   */
  private calculateMonthlyProjection(dailyUsage: Array<{ tokens: number }>): number {
    if (dailyUsage.length === 0) return 0;

    const totalTokens = dailyUsage.reduce((sum, day) => sum + day.tokens, 0);
    const avgDailyTokens = totalTokens / dailyUsage.length;
    
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    return Math.round(avgDailyTokens * daysInMonth);
  }

  /**
   * Get project-level breakdown
   */
  private async getProjectBreakdown(organizationId: string): Promise<Array<{
    projectId: string;
    projectTitle: string;
    tokens: number;
    cost: number;
  }>> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      
      const { data, error } = await this.supabase
        .from('usage_events')
        .select(`
          project_id,
          tokens_in,
          tokens_out,
          cost,
          projects!inner(title)
        `)
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString())
        .not('project_id', 'is', null);

      if (error || !data) {
        return [];
      }

      const breakdown: Record<string, { projectId: string; projectTitle: string; tokens: number; cost: number }> = {};

      data.forEach(event => {
        if (!event.project_id) return;
        
        if (!breakdown[event.project_id]) {
          breakdown[event.project_id] = {
            projectId: event.project_id,
            projectTitle: event.projects?.title || 'Unknown Project',
            tokens: 0,
            cost: 0,
          };
        }
        
        breakdown[event.project_id].tokens += (event.tokens_in || 0) + (event.tokens_out || 0);
        breakdown[event.project_id].cost += event.cost || 0;
      });

      return Object.values(breakdown).sort((a, b) => b.tokens - a.tokens);
    } catch (error) {
      console.error('Error getting project breakdown:', error);
      return [];
    }
  }

  /**
   * Get project costs for average calculation
   */
  private async getProjectCosts(organizationId: string): Promise<Array<{ projectId: string; cost: number }>> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      
      const { data, error } = await this.supabase
        .from('usage_events')
        .select('project_id, cost')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString())
        .not('project_id', 'is', null);

      if (error || !data) {
        return [];
      }

      const projectCosts: Record<string, number> = {};
      data.forEach(event => {
        if (!event.project_id) return;
        projectCosts[event.project_id] = (projectCosts[event.project_id] || 0) + (event.cost || 0);
      });

      return Object.entries(projectCosts).map(([projectId, cost]) => ({ projectId, cost }));
    } catch (error) {
      console.error('Error getting project costs:', error);
      return [];
    }
  }

  /**
   * Get peak usage hours
   */
  private async getPeakUsageHours(organizationId: string): Promise<Array<{ hour: number; tokens: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const { data, error } = await this.supabase
        .from('usage_events')
        .select('created_at, tokens_in, tokens_out')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString());

      if (error || !data) {
        return [];
      }

      const hourlyUsage: Record<number, number> = {};
      
      data.forEach(event => {
        const hour = new Date(event.created_at).getHours();
        const tokens = (event.tokens_in || 0) + (event.tokens_out || 0);
        hourlyUsage[hour] = (hourlyUsage[hour] || 0) + tokens;
      });

      return Object.entries(hourlyUsage)
        .map(([hour, tokens]) => ({ hour: parseInt(hour), tokens }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 5); // Top 5 peak hours
    } catch (error) {
      console.error('Error getting peak usage hours:', error);
      return [];
    }
  }

  /**
   * Generate usage alerts
   */
  private generateAlerts(currentUsage: any, plan: string): Array<{
    type: 'warning' | 'danger' | 'info';
    message: string;
    action?: string;
  }> {
    const alerts: Array<{ type: 'warning' | 'danger' | 'info'; message: string; action?: string }> = [];

    // High usage warnings
    Object.entries(currentUsage).forEach(([key, usage]: [string, any]) => {
      if (usage.percentage >= 90) {
        alerts.push({
          type: 'danger',
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} usage at ${usage.percentage}%`,
          action: 'Consider upgrading your plan',
        });
      } else if (usage.percentage >= 80) {
        alerts.push({
          type: 'warning',
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} usage at ${usage.percentage}%`,
        });
      }
    });

    // Plan-specific recommendations
    if (plan === 'starter') {
      alerts.push({
        type: 'info',
        message: 'Upgrade to Pro for more AI credits and advanced features',
        action: 'View Pro plan',
      });
    }

    return alerts;
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizations(organizationId: string): Promise<CostOptimization> {
    const analytics = await this.getUsageAnalytics(organizationId);
    const recommendations: CostOptimization['recommendations'] = [];
    let potentialSavings = 0;

    // Model optimization recommendations
    if (analytics.modelBreakdown['gpt-4o']) {
      const gpt4Usage = analytics.modelBreakdown['gpt-4o'];
      const potentialMiniSavings = Math.round(gpt4Usage.cost * 0.85); // 85% savings with mini
      
      recommendations.push({
        type: 'model_optimization',
        title: 'Switch to GPT-4o Mini for routine tasks',
        description: 'Use GPT-4o Mini for summarization and simple generation tasks',
        impact: 'high',
        savingsEstimate: potentialMiniSavings,
        implementation: 'Update model preferences in settings',
      });
      
      potentialSavings += potentialMiniSavings;
    }

    // Usage pattern optimization
    if (analytics.averageTokensPerCall > 2000) {
      recommendations.push({
        type: 'usage_pattern',
        title: 'Optimize prompt length',
        description: 'Reduce context size for better cost efficiency',
        impact: 'medium',
        savingsEstimate: Math.round(analytics.totalCost * 0.2),
        implementation: 'Use more targeted context in prompts',
      });
    }

    // Plan adjustment
    const usage = await planEnforcer.getOrganizationUsage(organizationId);
    if (usage) {
      const limits = PLAN_LIMITS[usage.currentPlan];
      if (usage.tokensThisMonth < limits.aiCredits * 0.3 && usage.currentPlan !== 'starter') {
        recommendations.push({
          type: 'plan_adjustment',
          title: 'Consider downgrading your plan',
          description: `You're using only ${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}% of your AI credits`,
          impact: 'medium',
          savingsEstimate: 0, // Would need billing amounts to calculate
          implementation: 'Review usage patterns and consider downgrading',
        });
      }
    }

    return {
      potentialSavings,
      recommendations,
    };
  }

  /**
   * Export usage data to CSV
   */
  async exportUsageData(organizationId: string, startDate: Date, endDate: Date): Promise<string> {
    const { data, error } = await this.supabase
      .from('usage_events')
      .select(`
        created_at,
        type,
        provider,
        model,
        tokens_in,
        tokens_out,
        cost,
        projects(title)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (error || !data) {
      throw new Error('Failed to export usage data');
    }

    const headers = ['Date', 'Type', 'Provider', 'Model', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost (cents)', 'Project'];
    const rows = data.map(event => [
      new Date(event.created_at).toISOString(),
      event.type,
      event.provider,
      event.model,
      event.tokens_in || 0,
      event.tokens_out || 0,
      (event.tokens_in || 0) + (event.tokens_out || 0),
      event.cost || 0,
      event.projects?.title || 'N/A',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

export const analyticsService = AnalyticsService.getInstance();