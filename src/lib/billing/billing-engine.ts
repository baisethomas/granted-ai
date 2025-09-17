import { supabaseBrowserClient } from '../supabase/client';
import { createServerSupabaseClient } from '../supabase/server';

export interface PlanPricing {
  id: string;
  name: string;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  features: string[];
  limits: {
    projects: number;
    documents: number;
    aiCredits: number;
    teamMembers: number;
  };
}

export const PLAN_PRICING: Record<string, PlanPricing> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 0, // Free
    yearlyPrice: 0,
    features: [
      '3 active projects',
      '25 document uploads',
      '100K AI credits per month',
      'Basic templates',
      'Email support',
    ],
    limits: {
      projects: 3,
      documents: 25,
      aiCredits: 100000,
      teamMembers: 1,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 2900, // $29/month
    yearlyPrice: 29000, // $290/year (2 months free)
    features: [
      '15 active projects',
      '200 document uploads',
      '1M AI credits per month',
      'Advanced templates',
      'Priority support',
      'Export to DOCX/PDF',
      'Team collaboration (5 members)',
    ],
    limits: {
      projects: 15,
      documents: 200,
      aiCredits: 1000000,
      teamMembers: 5,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    monthlyPrice: 9900, // $99/month
    yearlyPrice: 99000, // $990/year (2 months free)
    features: [
      '50 active projects',
      '1000 document uploads',
      '5M AI credits per month',
      'Custom templates',
      'Priority support',
      'Advanced analytics',
      'Team collaboration (25 members)',
      'Custom integrations',
    ],
    limits: {
      projects: 50,
      documents: 1000,
      aiCredits: 5000000,
      teamMembers: 25,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 29900, // $299/month
    yearlyPrice: 299000, // $2990/year (2 months free)
    features: [
      'Unlimited projects',
      'Unlimited documents',
      'Unlimited AI credits',
      'Custom templates & branding',
      'Dedicated support',
      'Advanced analytics',
      'Unlimited team members',
      'Custom integrations',
      'On-premise deployment',
      'SLA guarantee',
    ],
    limits: {
      projects: -1, // unlimited
      documents: -1,
      aiCredits: -1,
      teamMembers: -1,
    },
  },
};

export interface Invoice {
  id: string;
  organizationId: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: number; // in cents
  tax: number; // in cents
  total: number; // in cents
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  paidAt?: Date;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  total: number; // in cents
  metadata?: Record<string, any>;
}

export interface BillingCalculation {
  basePlan: {
    name: string;
    price: number;
    billing: 'monthly' | 'yearly';
  };
  usage: {
    aiCredits: {
      included: number;
      used: number;
      overage: number;
      overageRate: number; // per credit in cents
      overageCost: number;
    };
    seats: {
      included: number;
      used: number;
      additional: number;
      seatPrice: number; // per seat in cents
      additionalCost: number;
    };
  };
  subtotal: number;
  tax: number;
  total: number;
  nextBillingDate: Date;
}

export class BillingEngine {
  private static instance: BillingEngine;
  private supabase: any;

  private constructor() {
    this.supabase = typeof window !== 'undefined' 
      ? supabaseBrowserClient 
      : createServerSupabaseClient();
  }

  static getInstance(): BillingEngine {
    if (!BillingEngine.instance) {
      BillingEngine.instance = new BillingEngine();
    }
    return BillingEngine.instance;
  }

  /**
   * Calculate current billing amount for an organization
   */
  async calculateBilling(organizationId: string): Promise<BillingCalculation> {
    try {
      // Get organization and subscription info
      const { data: org, error: orgError } = await this.supabase
        .from('organizations')
        .select(`
          *,
          subscriptions (*)
        `)
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        throw new Error('Organization not found');
      }

      const subscription = org.subscriptions?.[0];
      const plan = org.plan || 'starter';
      const planPricing = PLAN_PRICING[plan];
      
      if (!planPricing) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      // Determine billing frequency
      const billing = subscription?.renewal_at && 
        new Date(subscription.renewal_at).getTime() - Date.now() > 40 * 24 * 60 * 60 * 1000 
        ? 'yearly' : 'monthly';

      const basePlanPrice = billing === 'yearly' ? planPricing.yearlyPrice : planPricing.monthlyPrice;

      // Get current month usage
      const usage = await this.getCurrentUsage(organizationId);
      
      // Calculate overages
      const aiCreditOverage = Math.max(0, usage.aiCreditsUsed - planPricing.limits.aiCredits);
      const aiCreditOverageRate = this.getAICreditOverageRate(plan);
      const aiCreditOverageCost = Math.round(aiCreditOverage * aiCreditOverageRate);

      const seatOverage = Math.max(0, usage.teamMembers - planPricing.limits.teamMembers);
      const seatPrice = this.getSeatPrice(plan);
      const seatOverageCost = seatOverage * seatPrice;

      // Calculate totals
      const subtotal = basePlanPrice + aiCreditOverageCost + seatOverageCost;
      const taxRate = 0.08; // 8% tax rate (should be configurable by location)
      const tax = Math.round(subtotal * taxRate);
      const total = subtotal + tax;

      // Next billing date
      const nextBillingDate = subscription?.renewal_at 
        ? new Date(subscription.renewal_at)
        : this.getNextBillingDate(billing);

      return {
        basePlan: {
          name: planPricing.name,
          price: basePlanPrice,
          billing,
        },
        usage: {
          aiCredits: {
            included: planPricing.limits.aiCredits,
            used: usage.aiCreditsUsed,
            overage: aiCreditOverage,
            overageRate: aiCreditOverageRate,
            overageCost: aiCreditOverageCost,
          },
          seats: {
            included: planPricing.limits.teamMembers,
            used: usage.teamMembers,
            additional: seatOverage,
            seatPrice,
            additionalCost: seatOverageCost,
          },
        },
        subtotal,
        tax,
        total,
        nextBillingDate,
      };
    } catch (error) {
      console.error('Error calculating billing:', error);
      throw error;
    }
  }

  /**
   * Get current usage for billing calculations
   */
  private async getCurrentUsage(organizationId: string): Promise<{
    aiCreditsUsed: number;
    teamMembers: number;
    projectsCount: number;
    documentsCount: number;
  }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get AI credits used this month
    const { data: usageData, error: usageError } = await this.supabase
      .from('usage_events')
      .select('tokens_in, tokens_out')
      .eq('organization_id', organizationId)
      .gte('created_at', startOfMonth.toISOString());

    const aiCreditsUsed = usageData?.reduce((total, event) => {
      return total + (event.tokens_in || 0) + (event.tokens_out || 0);
    }, 0) || 0;

    // Get team members count
    const { count: teamMembers, error: membersError } = await this.supabase
      .from('memberships')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId);

    // Get projects count
    const { count: projectsCount, error: projectsError } = await this.supabase
      .from('projects')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId);

    // Get documents count
    const { count: documentsCount, error: documentsError } = await this.supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('organization_id', organizationId);

    if (usageError || membersError || projectsError || documentsError) {
      console.error('Error fetching usage data:', {
        usageError,
        membersError,
        projectsError,
        documentsError,
      });
    }

    return {
      aiCreditsUsed,
      teamMembers: teamMembers || 0,
      projectsCount: projectsCount || 0,
      documentsCount: documentsCount || 0,
    };
  }

  /**
   * Generate invoice for billing period
   */
  async generateInvoice(organizationId: string, billingPeriodStart: Date, billingPeriodEnd: Date): Promise<Invoice> {
    const calculation = await this.calculateBilling(organizationId);
    
    const lineItems: InvoiceLineItem[] = [
      {
        description: `${calculation.basePlan.name} Plan (${calculation.basePlan.billing})`,
        quantity: 1,
        unitPrice: calculation.basePlan.price,
        total: calculation.basePlan.price,
      },
    ];

    // Add overage line items
    if (calculation.usage.aiCredits.overageCost > 0) {
      lineItems.push({
        description: `AI Credits Overage (${calculation.usage.aiCredits.overage.toLocaleString()} credits)`,
        quantity: calculation.usage.aiCredits.overage,
        unitPrice: calculation.usage.aiCredits.overageRate,
        total: calculation.usage.aiCredits.overageCost,
      });
    }

    if (calculation.usage.seats.additionalCost > 0) {
      lineItems.push({
        description: `Additional Team Members (${calculation.usage.seats.additional} seats)`,
        quantity: calculation.usage.seats.additional,
        unitPrice: calculation.usage.seats.seatPrice,
        total: calculation.usage.seats.additionalCost,
      });
    }

    return {
      id: `inv_${Date.now()}_${organizationId.slice(-8)}`,
      organizationId,
      billingPeriodStart,
      billingPeriodEnd,
      subtotal: calculation.subtotal,
      tax: calculation.tax,
      total: calculation.total,
      status: 'draft',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      lineItems,
      createdAt: new Date(),
    };
  }

  /**
   * Calculate prorated amount for plan changes
   */
  calculateProration(
    oldPlan: string,
    newPlan: string,
    daysRemaining: number,
    billing: 'monthly' | 'yearly' = 'monthly'
  ): { creditAmount: number; chargeAmount: number; netAmount: number } {
    const oldPricing = PLAN_PRICING[oldPlan];
    const newPricing = PLAN_PRICING[newPlan];

    if (!oldPricing || !newPricing) {
      throw new Error('Invalid plan for proration calculation');
    }

    const oldPrice = billing === 'yearly' ? oldPricing.yearlyPrice : oldPricing.monthlyPrice;
    const newPrice = billing === 'yearly' ? newPricing.yearlyPrice : newPricing.monthlyPrice;

    const daysInPeriod = billing === 'yearly' ? 365 : 30;
    const dailyOldRate = oldPrice / daysInPeriod;
    const dailyNewRate = newPrice / daysInPeriod;

    const creditAmount = Math.round(dailyOldRate * daysRemaining);
    const chargeAmount = Math.round(dailyNewRate * daysRemaining);
    const netAmount = chargeAmount - creditAmount;

    return { creditAmount, chargeAmount, netAmount };
  }

  /**
   * Get AI credit overage rate based on plan
   */
  private getAICreditOverageRate(plan: string): number {
    // Overage rates in cents per 1000 tokens
    const rates = {
      starter: 0.002, // $0.00002 per token
      pro: 0.0015, // $0.000015 per token  
      team: 0.001, // $0.00001 per token
      enterprise: 0.0005, // $0.000005 per token
    };

    return rates[plan as keyof typeof rates] || rates.starter;
  }

  /**
   * Get additional seat price based on plan
   */
  private getSeatPrice(plan: string): number {
    // Additional seat prices in cents per month
    const prices = {
      starter: 0, // No additional seats allowed
      pro: 1000, // $10 per additional seat
      team: 800, // $8 per additional seat
      enterprise: 500, // $5 per additional seat
    };

    return prices[plan as keyof typeof prices] || 0;
  }

  /**
   * Get next billing date
   */
  private getNextBillingDate(billing: 'monthly' | 'yearly'): Date {
    const next = new Date();
    if (billing === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  /**
   * Get plan comparison for upgrade/downgrade decisions
   */
  getPlanComparison(currentPlan: string, targetPlan: string): {
    featureComparison: Array<{
      feature: string;
      current: string | number | boolean;
      target: string | number | boolean;
      improved: boolean;
    }>;
    priceComparison: {
      currentMonthly: number;
      targetMonthly: number;
      difference: number;
      percentageChange: number;
    };
  } {
    const current = PLAN_PRICING[currentPlan];
    const target = PLAN_PRICING[targetPlan];

    if (!current || !target) {
      throw new Error('Invalid plans for comparison');
    }

    const featureComparison = [
      {
        feature: 'Projects',
        current: current.limits.projects === -1 ? 'Unlimited' : current.limits.projects,
        target: target.limits.projects === -1 ? 'Unlimited' : target.limits.projects,
        improved: target.limits.projects > current.limits.projects || target.limits.projects === -1,
      },
      {
        feature: 'Documents',
        current: current.limits.documents === -1 ? 'Unlimited' : current.limits.documents,
        target: target.limits.documents === -1 ? 'Unlimited' : target.limits.documents,
        improved: target.limits.documents > current.limits.documents || target.limits.documents === -1,
      },
      {
        feature: 'AI Credits',
        current: current.limits.aiCredits === -1 ? 'Unlimited' : current.limits.aiCredits.toLocaleString(),
        target: target.limits.aiCredits === -1 ? 'Unlimited' : target.limits.aiCredits.toLocaleString(),
        improved: target.limits.aiCredits > current.limits.aiCredits || target.limits.aiCredits === -1,
      },
      {
        feature: 'Team Members',
        current: current.limits.teamMembers === -1 ? 'Unlimited' : current.limits.teamMembers,
        target: target.limits.teamMembers === -1 ? 'Unlimited' : target.limits.teamMembers,
        improved: target.limits.teamMembers > current.limits.teamMembers || target.limits.teamMembers === -1,
      },
    ];

    const priceComparison = {
      currentMonthly: current.monthlyPrice,
      targetMonthly: target.monthlyPrice,
      difference: target.monthlyPrice - current.monthlyPrice,
      percentageChange: current.monthlyPrice > 0 
        ? ((target.monthlyPrice - current.monthlyPrice) / current.monthlyPrice) * 100
        : 0,
    };

    return { featureComparison, priceComparison };
  }

  /**
   * Estimate cost for usage patterns
   */
  estimateMonthlyCost(
    plan: string,
    estimatedUsage: {
      aiCredits: number;
      teamMembers: number;
      projects: number;
      documents: number;
    }
  ): {
    baseCost: number;
    overageCost: number;
    totalCost: number;
    warnings: string[];
  } {
    const planPricing = PLAN_PRICING[plan];
    if (!planPricing) {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const baseCost = planPricing.monthlyPrice;
    let overageCost = 0;
    const warnings: string[] = [];

    // Check AI credits
    if (planPricing.limits.aiCredits !== -1 && estimatedUsage.aiCredits > planPricing.limits.aiCredits) {
      const overage = estimatedUsage.aiCredits - planPricing.limits.aiCredits;
      const overageRate = this.getAICreditOverageRate(plan);
      overageCost += Math.round(overage * overageRate);
      warnings.push(`AI credits overage: ${overage.toLocaleString()} credits`);
    }

    // Check team members
    if (planPricing.limits.teamMembers !== -1 && estimatedUsage.teamMembers > planPricing.limits.teamMembers) {
      const additionalSeats = estimatedUsage.teamMembers - planPricing.limits.teamMembers;
      const seatPrice = this.getSeatPrice(plan);
      overageCost += additionalSeats * seatPrice;
      warnings.push(`Additional team members: ${additionalSeats} seats`);
    }

    // Check other limits
    if (planPricing.limits.projects !== -1 && estimatedUsage.projects > planPricing.limits.projects) {
      warnings.push(`Projects exceed limit: ${estimatedUsage.projects}/${planPricing.limits.projects}`);
    }

    if (planPricing.limits.documents !== -1 && estimatedUsage.documents > planPricing.limits.documents) {
      warnings.push(`Documents exceed limit: ${estimatedUsage.documents}/${planPricing.limits.documents}`);
    }

    return {
      baseCost,
      overageCost,
      totalCost: baseCost + overageCost,
      warnings,
    };
  }
}

export const billingEngine = BillingEngine.getInstance();