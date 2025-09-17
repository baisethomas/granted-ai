import { NextRequest, NextResponse } from "next/server";
import { qualityMetricsAnalyzer } from "@/lib/clarifications/quality-metrics";
import { clarificationDb } from "@/lib/clarifications/database";
import type { AssumptionLabel, ClarificationSession } from "@/lib/clarifications/types";

interface AssumptionTrackingRequest {
  projectId: string;
  draftId?: string;
  beforeText: string;
  afterText: string;
  beforeAssumptions: AssumptionLabel[];
  afterAssumptions: AssumptionLabel[];
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AssumptionTrackingRequest;
    const { 
      projectId, 
      draftId, 
      beforeText, 
      afterText, 
      beforeAssumptions, 
      afterAssumptions, 
      sessionId 
    } = body;

    if (!projectId || !beforeText || !afterText) {
      return NextResponse.json(
        { error: "Project ID, beforeText, and afterText are required" },
        { status: 400 }
      );
    }

    // Store assumptions in database
    if (beforeAssumptions.length > 0) {
      await clarificationDb.storeAssumptions(projectId, draftId || null, beforeAssumptions);
    }
    if (afterAssumptions.length > 0) {
      await clarificationDb.storeAssumptions(projectId, draftId || null, afterAssumptions);
    }

    // Get session data if sessionId provided
    let session: ClarificationSession | null = null;
    if (sessionId) {
      session = await clarificationDb.getSessionById(sessionId);
    }

    // Calculate assumption reduction metrics
    let assumptionMetrics;
    if (session) {
      assumptionMetrics = qualityMetricsAnalyzer.calculateAssumptionReduction(
        beforeAssumptions,
        afterAssumptions,
        session
      );
    } else {
      // Fallback calculation without session data
      assumptionMetrics = {
        totalReduction: beforeAssumptions.length > 0 
          ? ((beforeAssumptions.length - afterAssumptions.length) / beforeAssumptions.length) * 100 
          : 0,
        categoryReduction: calculateBasicCategoryReduction(beforeAssumptions, afterAssumptions),
        confidenceImprovement: 0,
        resolvedAssumptions: [],
        remainingCriticalAssumptions: afterAssumptions.filter(a => 
          a.confidence > 0.8 && ['budget', 'outcomes', 'methodology'].includes(a.category)
        )
      };
    }

    // Calculate comparison metrics
    const comparisonMetrics = qualityMetricsAnalyzer.calculateComparisonMetrics(
      beforeText,
      afterText,
      beforeAssumptions,
      afterAssumptions
    );

    // Generate insights and recommendations
    const insights = generateAssumptionInsights(assumptionMetrics, comparisonMetrics);
    const recommendations = generateAssumptionRecommendations(assumptionMetrics);

    return NextResponse.json({
      assumptionReduction: assumptionMetrics,
      comparison: comparisonMetrics,
      insights,
      recommendations,
      success: true
    });

  } catch (error) {
    console.error("Error tracking assumption reduction:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const draftId = searchParams.get('draftId');

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get assumptions for the project/draft
    const assumptions = await clarificationDb.getAssumptions(projectId, draftId || undefined);

    // Group assumptions by confidence level
    const highConfidence = assumptions.filter(a => a.confidence > 0.8);
    const mediumConfidence = assumptions.filter(a => a.confidence > 0.5 && a.confidence <= 0.8);
    const lowConfidence = assumptions.filter(a => a.confidence <= 0.5);

    // Group by category
    const byCategory: Record<string, AssumptionLabel[]> = {};
    assumptions.forEach(assumption => {
      if (!byCategory[assumption.category]) {
        byCategory[assumption.category] = [];
      }
      byCategory[assumption.category].push(assumption);
    });

    // Calculate summary statistics
    const summary = {
      total: assumptions.length,
      highConfidence: highConfidence.length,
      mediumConfidence: mediumConfidence.length,
      lowConfidence: lowConfidence.length,
      criticalCategories: ['budget', 'outcomes', 'methodology']
        .filter(cat => byCategory[cat] && byCategory[cat].some(a => a.confidence > 0.7))
    };

    return NextResponse.json({
      assumptions,
      byCategory,
      summary,
      recommendations: generateAssumptionViewRecommendations(summary, byCategory)
    });

  } catch (error) {
    console.error("Error retrieving assumption data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Calculate basic category reduction without session data
 */
function calculateBasicCategoryReduction(
  beforeAssumptions: AssumptionLabel[],
  afterAssumptions: AssumptionLabel[]
): Record<string, number> {
  const beforeByCategory: Record<string, number> = {};
  const afterByCategory: Record<string, number> = {};

  beforeAssumptions.forEach(a => {
    beforeByCategory[a.category] = (beforeByCategory[a.category] || 0) + 1;
  });

  afterAssumptions.forEach(a => {
    afterByCategory[a.category] = (afterByCategory[a.category] || 0) + 1;
  });

  const categoryReduction: Record<string, number> = {};
  for (const category of Object.keys(beforeByCategory)) {
    const before = beforeByCategory[category] || 0;
    const after = afterByCategory[category] || 0;
    categoryReduction[category] = before > 0 ? ((before - after) / before) * 100 : 0;
  }

  return categoryReduction;
}

/**
 * Generate insights about assumption reduction
 */
function generateAssumptionInsights(assumptionMetrics: any, comparisonMetrics: any): string[] {
  const insights: string[] = [];

  if (assumptionMetrics.totalReduction > 50) {
    insights.push("Excellent assumption reduction! Clarifications significantly strengthened evidence-based content.");
  } else if (assumptionMetrics.totalReduction > 25) {
    insights.push("Good assumption reduction achieved through clarifications.");
  } else if (assumptionMetrics.totalReduction > 0) {
    insights.push("Moderate assumption reduction. Additional clarifications could further improve content reliability.");
  } else {
    insights.push("No assumption reduction detected. Consider providing more specific evidence and data.");
  }

  // Category-specific insights
  const strongCategories = Object.entries(assumptionMetrics.categoryReduction)
    .filter(([_, reduction]: [string, any]) => reduction > 60)
    .map(([category, _]) => category);

  const weakCategories = Object.entries(assumptionMetrics.categoryReduction)
    .filter(([_, reduction]: [string, any]) => reduction < 20)
    .map(([category, _]) => category);

  if (strongCategories.length > 0) {
    insights.push(`Strong assumption reduction in: ${strongCategories.join(', ')}`);
  }

  if (weakCategories.length > 0) {
    insights.push(`Limited assumption reduction in: ${weakCategories.join(', ')} - consider more detailed evidence`);
  }

  // Critical assumptions remaining
  if (assumptionMetrics.remainingCriticalAssumptions.length > 0) {
    insights.push(`${assumptionMetrics.remainingCriticalAssumptions.length} high-confidence assumptions remain in critical categories`);
  }

  // Confidence improvement
  if (assumptionMetrics.confidenceImprovement > 30) {
    insights.push("Significant improvement in assumption confidence - content is more evidence-based");
  }

  // Content improvement
  if (comparisonMetrics.improvement.evidenceImprovement > 40) {
    insights.push("Strong increase in evidence integration reduces reliance on assumptions");
  }

  return insights;
}

/**
 * Generate recommendations for assumption reduction
 */
function generateAssumptionRecommendations(assumptionMetrics: any): string[] {
  const recommendations: string[] = [];

  if (assumptionMetrics.totalReduction < 30) {
    recommendations.push("Provide more specific data, research citations, and documented evidence to replace assumptions");
  }

  // Critical assumptions still present
  if (assumptionMetrics.remainingCriticalAssumptions.length > 0) {
    recommendations.push("Address remaining high-confidence assumptions in budget, outcomes, and methodology sections");
  }

  // Category-specific recommendations
  const poorPerformingCategories = Object.entries(assumptionMetrics.categoryReduction)
    .filter(([_, reduction]: [string, any]) => reduction < 25)
    .map(([category, _]) => category);

  poorPerformingCategories.forEach(category => {
    const categoryRecommendations = {
      budget: "Include detailed cost calculations, funding sources documentation, and financial projections",
      timeline: "Provide specific dates, milestone dependencies, and project management evidence",
      outcomes: "Add baseline data, validated assessment tools, and evaluation methodology details",
      methodology: "Include evidence-based practice citations, implementation protocols, and proven model references",
      team: "Document staff qualifications, organizational capacity assessments, and role specifications",
      sustainability: "Provide partnership agreements, funding diversification plans, and continuation strategies",
      evidence: "Add community needs data, demographic analysis, and supporting research documentation",
      specificity: "Include concrete numbers, locations, eligibility criteria, and measurable targets"
    };

    const rec = categoryRecommendations[category as keyof typeof categoryRecommendations];
    if (rec) {
      recommendations.push(`For ${category}: ${rec}`);
    }
  });

  if (recommendations.length === 0) {
    recommendations.push("Excellent assumption reduction! Continue providing specific, evidence-based details in future responses.");
  }

  return recommendations;
}

/**
 * Generate recommendations for assumption viewing
 */
function generateAssumptionViewRecommendations(
  summary: any, 
  byCategory: Record<string, AssumptionLabel[]>
): string[] {
  const recommendations: string[] = [];

  if (summary.highConfidence > 0) {
    recommendations.push(`Address ${summary.highConfidence} high-confidence assumptions with specific evidence and data`);
  }

  if (summary.criticalCategories.length > 0) {
    recommendations.push(`Critical assumptions detected in: ${summary.criticalCategories.join(', ')} - these impact funding viability`);
  }

  // Category with most assumptions
  const categoryCounts = Object.entries(byCategory).map(([cat, assumptions]) => ({
    category: cat,
    count: assumptions.length
  })).sort((a, b) => b.count - a.count);

  if (categoryCounts.length > 0 && categoryCounts[0].count > 2) {
    recommendations.push(`Most assumptions in ${categoryCounts[0].category} category (${categoryCounts[0].count}) - prioritize clarification here`);
  }

  if (summary.total === 0) {
    recommendations.push("No assumptions detected - content appears well-supported with evidence and specifics");
  }

  return recommendations;
}