import { NextRequest, NextResponse } from 'next/server';
import { optimizationService, costControlService } from '@/lib/billing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type'); // 'analysis', 'recommendations', 'forecast'
    
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    switch (type) {
      case 'analysis':
        const analysis = await optimizationService.generateOptimizationAnalysis(organizationId);
        return NextResponse.json(analysis);
        
      case 'recommendations':
        const recommendations = await optimizationService.getModelRecommendations(organizationId);
        return NextResponse.json({ recommendations });
        
      case 'forecast':
        const forecast = await costControlService.generateForecast(organizationId);
        return NextResponse.json({ forecast });
        
      case 'dashboard':
        const dashboard = await costControlService.getSpendingDashboard(organizationId);
        return NextResponse.json(dashboard);
        
      default:
        // Return comprehensive optimization data
        const [optimizationAnalysis, costDashboard] = await Promise.all([
          optimizationService.generateOptimizationAnalysis(organizationId),
          costControlService.getSpendingDashboard(organizationId),
        ]);
        
        return NextResponse.json({
          optimization: optimizationAnalysis,
          spending: costDashboard,
        });
    }
  } catch (error) {
    console.error('Error fetching optimization data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimization data' },
      { status: 500 }
    );
  }
}