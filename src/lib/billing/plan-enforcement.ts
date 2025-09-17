import { PLAN_LIMITS, type PlanLimits } from './types';
import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';

export interface PlanValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  upgradeRequired?: boolean;
  suggestedPlan?: string;
}

export interface OrganizationUsage {
  projectsCount: number;
  documentsCount: number;
  documentsThisMonth: number;
  tokensThisMonth: number;
  teamMembersCount: number;
  currentPlan: string;
}

export class PlanEnforcer {
  private static instance: PlanEnforcer;
  private supabase: any;

  private constructor() {
    // Use appropriate client based on environment
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): PlanEnforcer {
    if (!PlanEnforcer.instance) {
      PlanEnforcer.instance = new PlanEnforcer();
    }
    return PlanEnforcer.instance;
  }

  /**
   * Get current usage for an organization
   */
  async getOrganizationUsage(organizationId: string): Promise<OrganizationUsage | null> {
    try {
      // Get organization plan
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select('plan')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        console.error('Failed to fetch organization:', orgError);
        return null;
      }

      // Get projects count
      const { count: projectsCount, error: projectsError } = await this.supabase
        .from('projects')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId);

      if (projectsError) {
        console.error('Failed to count projects:', projectsError);
      }

      // Get documents count (total and this month)
      const { count: documentsCount, error: documentsError } = await this.supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: documentsThisMonth, error: documentsMonthError } = await this.supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId)
        .gte('uploaded_at', startOfMonth.toISOString());

      if (documentsError || documentsMonthError) {
        console.error('Failed to count documents:', documentsError || documentsMonthError);
      }

      // Get team members count
      const { count: teamMembersCount, error: membersError } = await this.supabase
        .from('memberships')
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId);

      if (membersError) {
        console.error('Failed to count team members:', membersError);
      }

      // Get token usage this month
      const { data: usageData, error: usageError } = await this.supabase
        .from('usage_events')
        .select('tokens_in, tokens_out')
        .eq('organization_id', organizationId)
        .gte('created_at', startOfMonth.toISOString());

      let tokensThisMonth = 0;
      if (usageData && !usageError) {
        tokensThisMonth = usageData.reduce((total, event) => {
          return total + (event.tokens_in || 0) + (event.tokens_out || 0);
        }, 0);
      } else if (usageError) {
        console.error('Failed to fetch usage data:', usageError);
      }

      return {
        projectsCount: projectsCount || 0,
        documentsCount: documentsCount || 0,
        documentsThisMonth: documentsThisMonth || 0,
        tokensThisMonth,
        teamMembersCount: teamMembersCount || 0,
        currentPlan: org.plan || 'starter',
      };
    } catch (error) {
      console.error('Error getting organization usage:', error);
      return null;
    }
  }

  /**
   * Check if organization can create a new project
   */
  async canCreateProject(organizationId: string): Promise<PlanValidationResult> {
    const usage = await this.getOrganizationUsage(organizationId);
    if (!usage) {
      return { allowed: false, reason: 'Unable to fetch organization usage' };
    }

    const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;
    
    if (limits.projects === -1) {
      return { allowed: true }; // Unlimited
    }

    if (usage.projectsCount >= limits.projects) {
      const suggestedPlan = this.getSuggestedUpgradePlan(usage.currentPlan, 'projects');
      return {
        allowed: false,
        reason: `Project limit reached. Your ${usage.currentPlan} plan allows ${limits.projects} projects.`,
        currentUsage: usage.projectsCount,
        limit: limits.projects,
        upgradeRequired: true,
        suggestedPlan,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if organization can upload a document
   */
  async canUploadDocument(organizationId: string): Promise<PlanValidationResult> {
    const usage = await this.getOrganizationUsage(organizationId);
    if (!usage) {
      return { allowed: false, reason: 'Unable to fetch organization usage' };
    }

    const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;
    
    // Check total documents limit
    if (limits.documents !== -1 && usage.documentsCount >= limits.documents) {
      const suggestedPlan = this.getSuggestedUpgradePlan(usage.currentPlan, 'documents');
      return {
        allowed: false,
        reason: `Document storage limit reached. Your ${usage.currentPlan} plan allows ${limits.documents} total documents.`,
        currentUsage: usage.documentsCount,
        limit: limits.documents,
        upgradeRequired: true,
        suggestedPlan,
      };
    }

    // Check monthly upload limit
    if (limits.documentsPerMonth !== -1 && usage.documentsThisMonth >= limits.documentsPerMonth) {
      const suggestedPlan = this.getSuggestedUpgradePlan(usage.currentPlan, 'documentsPerMonth');
      return {
        allowed: false,
        reason: `Monthly upload limit reached. Your ${usage.currentPlan} plan allows ${limits.documentsPerMonth} uploads per month.`,
        currentUsage: usage.documentsThisMonth,
        limit: limits.documentsPerMonth,
        upgradeRequired: true,
        suggestedPlan,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if organization can make an AI request
   */
  async canMakeAIRequest(organizationId: string, estimatedTokens: number = 1000): Promise<PlanValidationResult> {
    const usage = await this.getOrganizationUsage(organizationId);
    if (!usage) {
      return { allowed: false, reason: 'Unable to fetch organization usage' };
    }

    const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;
    
    if (limits.aiCredits === -1) {
      return { allowed: true }; // Unlimited
    }

    const remainingCredits = limits.aiCredits - usage.tokensThisMonth;
    
    if (remainingCredits < estimatedTokens) {
      const suggestedPlan = this.getSuggestedUpgradePlan(usage.currentPlan, 'aiCredits');
      return {
        allowed: false,
        reason: `AI credits exhausted. Your ${usage.currentPlan} plan provides ${limits.aiCredits} tokens per month.`,
        currentUsage: usage.tokensThisMonth,
        limit: limits.aiCredits,
        upgradeRequired: true,
        suggestedPlan,
      };
    }

    // Warning at 80% usage
    if (remainingCredits < limits.aiCredits * 0.2) {
      return {
        allowed: true,
        reason: `Warning: AI credits running low (${Math.round((usage.tokensThisMonth / limits.aiCredits) * 100)}% used)`,
        currentUsage: usage.tokensThisMonth,
        limit: limits.aiCredits,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if organization can add a team member
   */
  async canAddTeamMember(organizationId: string): Promise<PlanValidationResult> {
    const usage = await this.getOrganizationUsage(organizationId);
    if (!usage) {
      return { allowed: false, reason: 'Unable to fetch organization usage' };
    }

    const limits = PLAN_LIMITS[usage.currentPlan] || PLAN_LIMITS.starter;
    
    if (limits.teamMembers === -1) {
      return { allowed: true }; // Unlimited
    }

    if (usage.teamMembersCount >= limits.teamMembers) {
      const suggestedPlan = this.getSuggestedUpgradePlan(usage.currentPlan, 'teamMembers');
      return {
        allowed: false,
        reason: `Team member limit reached. Your ${usage.currentPlan} plan allows ${limits.teamMembers} team members.`,
        currentUsage: usage.teamMembersCount,
        limit: limits.teamMembers,
        upgradeRequired: true,
        suggestedPlan,
      };
    }

    return { allowed: true };
  }

  /**
   * Get rate limit for API calls
   */
  getRateLimit(plan: string): { calls: number; windowMs: number } {
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    return {
      calls: limits.apiCallsPerMinute,
      windowMs: 60 * 1000, // 1 minute
    };
  }

  /**
   * Get max tokens per request for a plan
   */
  getMaxTokensPerRequest(plan: string): number {
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    return limits.maxTokensPerRequest;
  }

  /**
   * Suggest upgrade plan based on current limitation
   */
  private getSuggestedUpgradePlan(currentPlan: string, limitType: keyof PlanLimits): string {
    const planHierarchy = ['starter', 'pro', 'team', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    
    if (currentIndex === -1 || currentIndex >= planHierarchy.length - 1) {
      return 'enterprise';
    }

    // Suggest next tier that supports the requirement
    for (let i = currentIndex + 1; i < planHierarchy.length; i++) {
      const nextPlan = planHierarchy[i];
      const nextLimits = PLAN_LIMITS[nextPlan];
      
      if (nextLimits[limitType] === -1 || 
          (typeof nextLimits[limitType] === 'number' && nextLimits[limitType] > (PLAN_LIMITS[currentPlan][limitType] as number))) {
        return nextPlan;
      }
    }

    return 'enterprise';
  }

  /**
   * Get usage percentage for a specific metric
   */
  getUsagePercentage(current: number, limit: number): number {
    if (limit === -1) return 0; // Unlimited
    if (limit === 0) return 100;
    return Math.min(Math.round((current / limit) * 100), 100);
  }

  /**
   * Check all limits for an organization
   */
  async checkAllLimits(organizationId: string): Promise<{
    projects: PlanValidationResult;
    documents: PlanValidationResult;
    aiCredits: PlanValidationResult;
    teamMembers: PlanValidationResult;
  }> {
    const [projects, documents, aiCredits, teamMembers] = await Promise.all([
      this.canCreateProject(organizationId),
      this.canUploadDocument(organizationId),
      this.canMakeAIRequest(organizationId),
      this.canAddTeamMember(organizationId),
    ]);

    return { projects, documents, aiCredits, teamMembers };
  }
}

export const planEnforcer = PlanEnforcer.getInstance();