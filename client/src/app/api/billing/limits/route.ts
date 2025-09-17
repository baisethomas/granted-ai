import { NextRequest, NextResponse } from 'next/server';

// Mock plan limits for different subscription tiers
const planLimits = {
  starter: {
    projects: 3,
    documents: 25,
    aiCredits: 100000,
    teamMembers: 1
  },
  pro: {
    projects: 15,
    documents: 200,
    aiCredits: 1000000,
    teamMembers: 5
  },
  team: {
    projects: 50,
    documents: 1000,
    aiCredits: 5000000,
    teamMembers: 25
  },
  enterprise: {
    projects: -1, // -1 means unlimited
    documents: -1,
    aiCredits: -1,
    teamMembers: -1
  }
};

// Mock current usage
const mockCurrentUsage = {
  projects: 8,
  documents: 23,
  aiCredits: 850000,
  teamMembers: 3
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, limitType, requestedAmount = 1 } = body;

    if (!organizationId || !limitType) {
      return NextResponse.json(
        { error: 'organizationId and limitType are required' },
        { status: 400 }
      );
    }

    // In a real implementation, this would:
    // 1. Look up the organization's current subscription plan
    // 2. Get current usage from the database
    // 3. Check if the requested amount would exceed limits

    // For demo purposes, assume this organization is on 'pro' plan
    const currentPlan = 'pro';
    const limits = planLimits[currentPlan as keyof typeof planLimits];
    const currentUsage = mockCurrentUsage[limitType as keyof typeof mockCurrentUsage] || 0;
    const limit = limits[limitType as keyof typeof limits];

    // -1 means unlimited
    if (limit === -1) {
      return NextResponse.json({
        allowed: true,
        usage: {
          current: currentUsage,
          limit: 'unlimited',
          percentUsed: 0
        }
      });
    }

    const wouldExceed = (currentUsage + requestedAmount) > limit;
    const percentUsed = Math.round((currentUsage / limit) * 100);

    if (wouldExceed) {
      let reason;
      switch (limitType) {
        case 'projects':
          reason = `You have reached your plan limit of ${limit} projects. Upgrade to create more projects.`;
          break;
        case 'documents':
          reason = `You have reached your plan limit of ${limit} documents. Upgrade to upload more documents.`;
          break;
        case 'ai_credits':
          reason = `You have reached your monthly AI credits limit of ${limit.toLocaleString()} tokens. Upgrade or wait for next month.`;
          break;
        case 'team_members':
          reason = `You have reached your plan limit of ${limit} team members. Upgrade to add more members.`;
          break;
        default:
          reason = `You have reached your plan limit for ${limitType}.`;
      }

      return NextResponse.json({
        allowed: false,
        reason,
        usage: {
          current: currentUsage,
          limit,
          percentUsed
        }
      });
    }

    return NextResponse.json({
      allowed: true,
      usage: {
        current: currentUsage,
        limit,
        percentUsed
      }
    });

  } catch (error) {
    console.error('Error checking limits:', error);
    return NextResponse.json(
      { error: 'Failed to check limits' },
      { status: 500 }
    );
  }
}