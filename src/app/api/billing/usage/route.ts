import { NextRequest, NextResponse } from 'next/server';
import { analyticsService, tokenTracker } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const [dashboardData, currentUsage] = await Promise.all([
      analyticsService.getDashboardData(organizationId),
      tokenTracker.getCurrentMonthUsage(organizationId),
    ]);

    return NextResponse.json({
      dashboard: dashboardData,
      current: currentUsage,
    });
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
    const {
      organizationId,
      userId,
      projectId,
      type,
      provider,
      model,
      inputTokens,
      outputTokens,
      metadata = {},
    } = body;

    if (!organizationId || !userId || !type || !provider || !model) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const success = await tokenTracker.trackUsage({
      organizationId,
      userId,
      projectId,
      type,
      provider,
      model,
      inputTokens: inputTokens || 0,
      outputTokens: outputTokens || 0,
      metadata,
    });

    if (!success) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking usage:', error);
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    );
  }
}