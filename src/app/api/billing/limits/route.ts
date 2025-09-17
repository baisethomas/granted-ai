import { NextRequest, NextResponse } from 'next/server';
import { planEnforcer } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const action = searchParams.get('action'); // 'project', 'document', 'ai_request', 'team_member'
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    if (action) {
      // Check specific limit
      let result;
      switch (action) {
        case 'project':
          result = await planEnforcer.canCreateProject(organizationId);
          break;
        case 'document':
          result = await planEnforcer.canUploadDocument(organizationId);
          break;
        case 'ai_request':
          const estimatedTokens = parseInt(searchParams.get('estimatedTokens') || '1000');
          result = await planEnforcer.canMakeAIRequest(organizationId, estimatedTokens);
          break;
        case 'team_member':
          result = await planEnforcer.canAddTeamMember(organizationId);
          break;
        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }
      
      return NextResponse.json(result);
    } else {
      // Check all limits
      const allLimits = await planEnforcer.checkAllLimits(organizationId);
      return NextResponse.json(allLimits);
    }
  } catch (error) {
    console.error('Error checking limits:', error);
    return NextResponse.json(
      { error: 'Failed to check limits' },
      { status: 500 }
    );
  }
}