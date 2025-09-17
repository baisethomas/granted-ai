import { NextRequest, NextResponse } from 'next/server';

// Mock usage data for development
const mockUsageData = {
  currentPeriod: {
    tokensUsed: 850000,
    costUsd: 25.40,
    eventsCount: 147,
    projectsCreated: 8,
    documentsUploaded: 23
  },
  limits: {
    projects: 15,
    documents: 200,
    aiCredits: 1000000,
    teamMembers: 5
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Organization ID required' },
      { status: 400 }
    );
  }

  try {
    // Calculate percentage usage
    const percentUsed = {
      tokens: Math.round((mockUsageData.currentPeriod.tokensUsed / mockUsageData.limits.aiCredits) * 100),
      projects: Math.round((mockUsageData.currentPeriod.projectsCreated / mockUsageData.limits.projects) * 100),
      documents: Math.round((mockUsageData.currentPeriod.documentsUploaded / mockUsageData.limits.documents) * 100)
    };

    // Generate alerts based on usage
    const alerts = [];
    if (percentUsed.tokens >= 100) {
      alerts.push({
        type: 'threshold_100',
        message: 'AI credits limit reached. Upgrade your plan to continue generating responses.',
        severity: 'high',
        timestamp: new Date()
      });
    } else if (percentUsed.tokens >= 80) {
      alerts.push({
        type: 'threshold_80',
        message: 'You have used 80% of your AI credits this month.',
        severity: 'medium',
        timestamp: new Date()
      });
    } else if (percentUsed.tokens >= 50) {
      alerts.push({
        type: 'threshold_50',
        message: 'You have used 50% of your AI credits this month.',
        severity: 'low',
        timestamp: new Date()
      });
    }

    const response = {
      ...mockUsageData,
      percentUsed,
      alerts
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, event } = body;

    if (action === 'track') {
      // In a real implementation, this would save to the database
      console.log('Usage event tracked:', {
        timestamp: new Date().toISOString(),
        ...event
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error tracking usage:', error);
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    );
  }
}