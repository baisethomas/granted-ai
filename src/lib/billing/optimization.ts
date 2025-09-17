import { analyticsService } from './analytics';
import { billingEngine } from './billing-engine';
import { planEnforcer } from './plan-enforcement';
import { PLAN_LIMITS, MODEL_PRICING, type ModelName } from './types';
import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';

export interface OptimizationRecommendation {
  id: string;
  type: 'cost_reduction' | 'performance_improvement' | 'plan_optimization' | 'usage_efficiency';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: {
    costSavings?: number; // monthly savings in cents
    performanceGain?: number; // percentage improvement
    efficiencyGain?: number; // percentage improvement
  };
  implementation: {
    difficulty: 'easy' | 'moderate' | 'advanced';
    timeRequired: string;
    steps: string[];
    requiresUpgrade?: boolean;
  };
  evidence: {
    currentState: Record<string, any>;
    potentialState: Record<string, any>;
    dataPoints: Array<{
      metric: string;
      current: number;
      potential: number;
      unit: string;
    }>;
  };
  tags: string[];
}

export interface OptimizationAnalysis {
  organizationId: string;
  analysisDate: Date;
  currentEfficiency: {
    costPerToken: number;
    avgTokensPerCall: number;
    modelEfficiencyScore: number; // 0-100
    planUtilizationScore: number; // 0-100
    overallScore: number; // 0-100
  };
  recommendations: OptimizationRecommendation[];
  quickWins: OptimizationRecommendation[]; // Easy, high-impact recommendations
  potentialSavings: {
    monthly: number;
    yearly: number;
  };
}

export interface ModelRecommendation {
  currentModel: string;
  suggestedModel: string;
  useCase: string;
  costReduction: number; // percentage
  qualityImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  reasoning: string;
}

export class OptimizationService {
  private static instance: OptimizationService;
  private supabase: any;

  private constructor() {
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): OptimizationService {
    if (!OptimizationService.instance) {
      OptimizationService.instance = new OptimizationService();
    }
    return OptimizationService.instance;
  }

  /**
   * Generate comprehensive optimization analysis
   */
  async generateOptimizationAnalysis(organizationId: string): Promise<OptimizationAnalysis> {
    const [usage, dashboardData, billing] = await Promise.all([
      planEnforcer.getOrganizationUsage(organizationId),
      analyticsService.getDashboardData(organizationId),
      billingEngine.calculateBilling(organizationId),
    ]);

    if (!usage) {
      throw new Error('Unable to fetch organization usage');
    }

    // Calculate current efficiency scores
    const currentEfficiency = await this.calculateEfficiencyScores(organizationId, usage, dashboardData);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(organizationId, usage, dashboardData, billing);

    // Identify quick wins (easy + high impact)
    const quickWins = recommendations.filter(r => 
      r.implementation.difficulty === 'easy' && 
      (r.priority === 'high' || r.priority === 'critical')
    );

    // Calculate potential savings
    const potentialSavings = this.calculatePotentialSavings(recommendations);

    return {
      organizationId,
      analysisDate: new Date(),
      currentEfficiency,
      recommendations,
      quickWins,
      potentialSavings,
    };
  }

  /**
   * Calculate efficiency scores
   */
  private async calculateEfficiencyScores(
    organizationId: string, 
    usage: any, 
    dashboardData: any
  ): Promise<OptimizationAnalysis['currentEfficiency']> {
    const efficiency = dashboardData.efficiency;
    const limits = PLAN_LIMITS[usage.currentPlan];

    // Cost per token efficiency (lower is better, score is inverted)
    const avgCostPerToken = 0.0005; // benchmark
    const costEfficiencyScore = Math.max(0, 100 - ((efficiency.costPerToken / avgCostPerToken) * 100));

    // Model efficiency based on usage patterns
    const modelEfficiencyScore = await this.calculateModelEfficiency(organizationId);

    // Plan utilization (too low or too high is bad)
    const tokenUtilization = limits.aiCredits !== -1 ? (usage.tokensThisMonth / limits.aiCredits) * 100 : 50;
    const planUtilizationScore = tokenUtilization > 20 && tokenUtilization < 90 ? 
      Math.max(0, 100 - Math.abs(tokenUtilization - 60)) : // Optimal around 60%
      Math.max(0, 60 - Math.abs(tokenUtilization - 30)); // Penalty for extreme values

    const overallScore = (costEfficiencyScore + modelEfficiencyScore + planUtilizationScore) / 3;

    return {
      costPerToken: efficiency.costPerToken,
      avgTokensPerCall: efficiency.avgTokensPerCall,
      modelEfficiencyScore,
      planUtilizationScore,
      overallScore,
    };
  }

  /**
   * Calculate model efficiency score
   */
  private async calculateModelEfficiency(organizationId: string): Promise<number> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      const { data: events, error } = await this.supabase
        .from('usage_events')
        .select('type, model, tokens_in, tokens_out, cost')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error || !events || events.length === 0) {
        return 50; // Default neutral score
      }

      let inefficiencyPenalty = 0;
      const totalCost = events.reduce((sum, e) => sum + (e.cost || 0), 0);

      // Penalize expensive models for simple tasks
      const summaryEvents = events.filter(e => e.type === 'summarization');
      const expensiveSummaries = summaryEvents.filter(e => 
        e.model?.includes('gpt-4o') && !e.model?.includes('mini')
      );
      
      if (summaryEvents.length > 0) {
        const expensiveRatio = expensiveSummaries.length / summaryEvents.length;
        inefficiencyPenalty += expensiveRatio * 30; // Up to 30 point penalty
      }

      // Penalize high token usage with low output (inefficient prompts)
      const avgTokensPerCall = events.reduce((sum, e) => sum + (e.tokens_in || 0), 0) / events.length;
      if (avgTokensPerCall > 2000) {
        inefficiencyPenalty += 20; // 20 point penalty for verbose prompts
      }

      return Math.max(0, 100 - inefficiencyPenalty);
    } catch (error) {
      console.error('Error calculating model efficiency:', error);
      return 50;
    }
  }

  /**
   * Generate optimization recommendations
   */
  private async generateRecommendations(
    organizationId: string,
    usage: any,
    dashboardData: any,
    billing: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Model optimization recommendations
    const modelRecs = await this.generateModelRecommendations(organizationId);
    recommendations.push(...modelRecs);

    // Plan optimization recommendations
    const planRecs = await this.generatePlanRecommendations(organizationId, usage, billing);
    recommendations.push(...planRecs);

    // Usage pattern recommendations
    const usageRecs = await this.generateUsageRecommendations(organizationId, dashboardData);
    recommendations.push(...usageRecs);

    // Cost control recommendations
    const costRecs = await this.generateCostControlRecommendations(organizationId, billing);
    recommendations.push(...costRecs);

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate model-specific recommendations
   */
  private async generateModelRecommendations(organizationId: string): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      const { data: events, error } = await this.supabase
        .from('usage_events')
        .select('type, model, tokens_in, tokens_out, cost')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error || !events || events.length === 0) {
        return recommendations;
      }

      // Analyze summarization tasks using expensive models
      const summaryEvents = events.filter(e => e.type === 'summarization');
      const expensiveSummaries = summaryEvents.filter(e => 
        (e.model?.includes('gpt-4o') && !e.model?.includes('mini')) ||
        e.model?.includes('claude-3-5-sonnet')
      );

      if (expensiveSummaries.length > 0 && expensiveSummaries.length / summaryEvents.length > 0.3) {
        const currentCost = expensiveSummaries.reduce((sum, e) => sum + (e.cost || 0), 0);
        const potentialSavings = Math.round(currentCost * 0.85); // 85% savings with cheaper models

        recommendations.push({
          id: `model_opt_summary_${organizationId}`,
          type: 'cost_reduction',
          priority: 'high',
          title: 'Switch to cost-efficient models for summarization',
          description: 'Use GPT-4o Mini or Claude Haiku for document summarization tasks instead of premium models',
          impact: {
            costSavings: potentialSavings,
            performanceGain: 0,
            efficiencyGain: 15,
          },
          implementation: {
            difficulty: 'easy',
            timeRequired: '5 minutes',
            steps: [
              'Go to Organization Settings',
              'Update default model for summarization to GPT-4o Mini',
              'Save changes',
            ],
          },
          evidence: {
            currentState: {
              summaryTasks: summaryEvents.length,
              expensiveModels: expensiveSummaries.length,
              currentCost: currentCost,
            },
            potentialState: {
              modelSwitch: 'GPT-4o Mini',
              projectedCost: currentCost - potentialSavings,
              qualityImpact: 'Minimal',
            },
            dataPoints: [
              { metric: 'Monthly Cost', current: currentCost, potential: currentCost - potentialSavings, unit: 'cents' },
              { metric: 'Cost Reduction', current: 0, potential: 85, unit: '%' },
            ],
          },
          tags: ['cost-savings', 'model-optimization', 'quick-win'],
        });
      }

      // Analyze high token usage patterns
      const highTokenEvents = events.filter(e => (e.tokens_in || 0) > 3000);
      if (highTokenEvents.length > events.length * 0.3) {
        const wastedTokens = highTokenEvents.reduce((sum, e) => sum + Math.max(0, (e.tokens_in || 0) - 2000), 0);
        const wastedCost = Math.round(wastedTokens * 0.00005 * 100); // Approximate cost in cents

        recommendations.push({
          id: `usage_opt_tokens_${organizationId}`,
          type: 'usage_efficiency',
          priority: 'medium',
          title: 'Optimize prompt length and context',
          description: 'Reduce input token usage by optimizing prompts and using more focused document chunks',
          impact: {
            costSavings: wastedCost,
            performanceGain: 10,
            efficiencyGain: 20,
          },
          implementation: {
            difficulty: 'moderate',
            timeRequired: '30 minutes',
            steps: [
              'Review high-token usage patterns in analytics',
              'Optimize document chunking strategy',
              'Refine prompts to be more concise',
              'Use selective context retrieval',
            ],
          },
          evidence: {
            currentState: {
              avgTokensPerCall: events.reduce((sum, e) => sum + (e.tokens_in || 0), 0) / events.length,
              highTokenCalls: highTokenEvents.length,
              wastedTokens,
            },
            potentialState: {
              targetTokensPerCall: 2000,
              potentialSavings: wastedCost,
            },
            dataPoints: [
              { metric: 'Average Tokens/Call', current: events.reduce((sum, e) => sum + (e.tokens_in || 0), 0) / events.length, potential: 2000, unit: 'tokens' },
              { metric: 'Wasted Tokens', current: wastedTokens, potential: 0, unit: 'tokens' },
            ],
          },
          tags: ['efficiency', 'prompt-optimization'],
        });
      }

    } catch (error) {
      console.error('Error generating model recommendations:', error);
    }

    return recommendations;
  }

  /**
   * Generate plan optimization recommendations
   */
  private async generatePlanRecommendations(
    organizationId: string,
    usage: any,
    billing: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const limits = PLAN_LIMITS[usage.currentPlan];

    // Check if plan is underutilized
    if (limits.aiCredits !== -1 && usage.tokensThisMonth < limits.aiCredits * 0.3 && usage.currentPlan !== 'starter') {
      const currentCost = billing.basePlan.price;
      const starterLimits = PLAN_LIMITS.starter;
      
      if (usage.tokensThisMonth <= starterLimits.aiCredits && 
          usage.projectsCount <= starterLimits.projects &&
          usage.teamMembersCount <= starterLimits.teamMembers) {
        
        recommendations.push({
          id: `plan_downgrade_${organizationId}`,
          type: 'plan_optimization',
          priority: 'medium',
          title: 'Consider downgrading to Starter plan',
          description: `You're using only ${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}% of your ${usage.currentPlan} plan resources`,
          impact: {
            costSavings: currentCost, // Full plan cost savings
            efficiencyGain: 0,
          },
          implementation: {
            difficulty: 'easy',
            timeRequired: '2 minutes',
            steps: [
              'Review your actual usage vs plan limits',
              'Go to Billing & Subscription',
              'Downgrade to Starter plan',
              'Keep monitoring usage for future needs',
            ],
          },
          evidence: {
            currentState: {
              plan: usage.currentPlan,
              utilization: `${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}%`,
              monthlyCost: currentCost,
            },
            potentialState: {
              plan: 'starter',
              monthlyCost: 0,
              savings: currentCost,
            },
            dataPoints: [
              { metric: 'AI Credits Used', current: usage.tokensThisMonth, potential: usage.tokensThisMonth, unit: 'tokens' },
              { metric: 'Plan Limit', current: limits.aiCredits, potential: starterLimits.aiCredits, unit: 'tokens' },
              { metric: 'Monthly Cost', current: currentCost, potential: 0, unit: 'cents' },
            ],
          },
          tags: ['plan-optimization', 'cost-savings'],
        });
      }
    }

    // Check if plan is overutilized
    if (limits.aiCredits !== -1 && usage.tokensThisMonth > limits.aiCredits * 0.8) {
      const nextPlan = this.getNextPlanUp(usage.currentPlan);
      if (nextPlan) {
        const nextLimits = PLAN_LIMITS[nextPlan];
        const overageCost = Math.max(0, usage.tokensThisMonth - limits.aiCredits) * 0.002 * 100;

        recommendations.push({
          id: `plan_upgrade_${organizationId}`,
          type: 'plan_optimization',
          priority: usage.tokensThisMonth > limits.aiCredits ? 'high' : 'medium',
          title: `Consider upgrading to ${nextPlan} plan`,
          description: `You're using ${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}% of your plan limits`,
          impact: {
            costSavings: overageCost > 0 ? overageCost * 0.5 : 0, // Save on overage charges
            efficiencyGain: 25,
          },
          implementation: {
            difficulty: 'easy',
            timeRequired: '2 minutes',
            steps: [
              'Go to Billing & Subscription',
              `Upgrade to ${nextPlan} plan`,
              'Confirm billing changes',
            ],
          },
          evidence: {
            currentState: {
              plan: usage.currentPlan,
              utilization: `${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}%`,
              overageRisk: usage.tokensThisMonth > limits.aiCredits,
            },
            potentialState: {
              plan: nextPlan,
              newLimit: nextLimits.aiCredits,
              avoidOverage: true,
            },
            dataPoints: [
              { metric: 'Current Limit', current: limits.aiCredits, potential: nextLimits.aiCredits, unit: 'tokens' },
              { metric: 'Usage', current: usage.tokensThisMonth, potential: usage.tokensThisMonth, unit: 'tokens' },
            ],
          },
          tags: ['plan-optimization', 'capacity'],
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate usage pattern recommendations
   */
  private async generateUsageRecommendations(
    organizationId: string,
    dashboardData: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for peak usage patterns
    const peakHours = dashboardData.efficiency.peakUsageHours;
    if (peakHours.length > 0) {
      const topPeakHour = peakHours[0];
      if (topPeakHour.tokens > dashboardData.trends.dailyUsage.reduce((sum, day) => sum + day.tokens, 0) * 0.3) {
        recommendations.push({
          id: `usage_pattern_${organizationId}`,
          type: 'usage_efficiency',
          priority: 'low',
          title: 'Optimize peak usage hours',
          description: `Most usage occurs at ${topPeakHour.hour}:00. Consider distributing workload for better rate limits`,
          impact: {
            performanceGain: 10,
            efficiencyGain: 5,
          },
          implementation: {
            difficulty: 'moderate',
            timeRequired: '1 hour',
            steps: [
              'Identify batch processing tasks',
              'Schedule heavy AI tasks during off-peak hours',
              'Use async processing where possible',
              'Implement request queuing',
            ],
          },
          evidence: {
            currentState: {
              peakHour: `${topPeakHour.hour}:00`,
              peakUsage: topPeakHour.tokens,
              concentrationRatio: '30%+',
            },
            potentialState: {
              distributedLoad: true,
              improvedLatency: '10-15%',
            },
            dataPoints: [
              { metric: 'Peak Hour Usage', current: topPeakHour.tokens, potential: topPeakHour.tokens * 0.7, unit: 'tokens' },
              { metric: 'Load Distribution', current: 30, potential: 15, unit: '% concentration' },
            ],
          },
          tags: ['performance', 'load-balancing'],
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate cost control recommendations
   */
  private async generateCostControlRecommendations(
    organizationId: string,
    billing: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Suggest setting up budget alerts if not configured
    try {
      const { data: budgetSettings } = await this.supabase
        .from('budget_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (!budgetSettings || !budgetSettings.monthly_budget) {
        const suggestedBudget = Math.round(billing.subtotal * 1.2); // 20% buffer

        recommendations.push({
          id: `budget_setup_${organizationId}`,
          type: 'cost_reduction',
          priority: 'medium',
          title: 'Set up budget alerts and spending limits',
          description: 'Configure budget alerts to avoid unexpected overspending',
          impact: {
            costSavings: 0,
            efficiencyGain: 20,
          },
          implementation: {
            difficulty: 'easy',
            timeRequired: '5 minutes',
            steps: [
              'Go to Cost Management settings',
              `Set monthly budget to $${suggestedBudget / 100} (20% above current spend)`,
              'Enable 80% and 95% usage alerts',
              'Configure email notifications',
            ],
          },
          evidence: {
            currentState: {
              budgetConfigured: false,
              currentSpend: billing.subtotal,
              alertsEnabled: false,
            },
            potentialState: {
              budgetConfigured: true,
              suggestedBudget: suggestedBudget,
              costVisibility: 'Full',
            },
            dataPoints: [
              { metric: 'Current Spend', current: billing.subtotal, potential: billing.subtotal, unit: 'cents' },
              { metric: 'Budget Protection', current: 0, potential: 100, unit: '% coverage' },
            ],
          },
          tags: ['budget-management', 'cost-control'],
        });
      }
    } catch (error) {
      console.error('Error checking budget settings:', error);
    }

    return recommendations;
  }

  /**
   * Get the next plan up in hierarchy
   */
  private getNextPlanUp(currentPlan: string): string | null {
    const planHierarchy = ['starter', 'pro', 'team', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    
    if (currentIndex === -1 || currentIndex >= planHierarchy.length - 1) {
      return null;
    }
    
    return planHierarchy[currentIndex + 1];
  }

  /**
   * Calculate total potential savings from recommendations
   */
  private calculatePotentialSavings(recommendations: OptimizationRecommendation[]): {
    monthly: number;
    yearly: number;
  } {
    const monthly = recommendations.reduce((total, rec) => 
      total + (rec.impact.costSavings || 0), 0
    );
    
    return {
      monthly,
      yearly: monthly * 12,
    };
  }

  /**
   * Get model-specific recommendations for different use cases
   */
  async getModelRecommendations(organizationId: string): Promise<ModelRecommendation[]> {
    const recommendations: ModelRecommendation[] = [];

    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      const { data: events, error } = await this.supabase
        .from('usage_events')
        .select('type, model, cost, tokens_in, tokens_out')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      if (error || !events) {
        return recommendations;
      }

      // Analyze by use case
      const byType = events.reduce((acc, event) => {
        if (!acc[event.type]) {
          acc[event.type] = [];
        }
        acc[event.type].push(event);
        return acc;
      }, {} as Record<string, typeof events>);

      Object.entries(byType).forEach(([type, typeEvents]) => {
        const expensiveModels = typeEvents.filter(e => 
          e.model?.includes('gpt-4o') || e.model?.includes('claude-3-5-sonnet')
        );

        if (expensiveModels.length > 0) {
          let suggestedModel = '';
          let costReduction = 0;
          let qualityImpact: ModelRecommendation['qualityImpact'] = 'minimal';

          if (type === 'summarization') {
            suggestedModel = 'gpt-4o-mini';
            costReduction = 85;
            qualityImpact = 'minimal';
          } else if (type === 'generation') {
            suggestedModel = 'gpt-4o-mini';
            costReduction = 75;
            qualityImpact = 'moderate';
          } else if (type === 'embedding') {
            suggestedModel = 'text-embedding-3-small';
            costReduction = 90;
            qualityImpact = 'none';
          }

          if (suggestedModel) {
            recommendations.push({
              currentModel: expensiveModels[0].model,
              suggestedModel,
              useCase: type,
              costReduction,
              qualityImpact,
              reasoning: `For ${type} tasks, ${suggestedModel} provides ${costReduction}% cost savings with ${qualityImpact} quality impact`,
            });
          }
        }
      });

      return recommendations;
    } catch (error) {
      console.error('Error generating model recommendations:', error);
      return recommendations;
    }
  }
}

export const optimizationService = OptimizationService.getInstance();