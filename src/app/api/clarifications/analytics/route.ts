import { NextRequest, NextResponse } from "next/server";
import { clarificationDb } from "@/lib/clarifications/database";
import { qualityMetricsAnalyzer } from "@/lib/clarifications/quality-metrics";
import type { ClarificationSession } from "@/lib/clarifications/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const sessionId = searchParams.get('sessionId');
    const type = searchParams.get('type') || 'overview'; // overview, session, comparison

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    switch (type) {
      case 'overview':
        // Get overall analytics for the organization
        const overviewAnalytics = await clarificationDb.getAnalytics(organizationId);
        const recentSessions = await clarificationDb.getRecentSessions(organizationId, 5);
        
        return NextResponse.json({
          analytics: overviewAnalytics,
          recentSessions: recentSessions.map(session => ({
            projectId: session.projectId,
            status: session.status,
            completionRate: session.completionRate,
            questionCount: session.questions.length,
            answerCount: session.answers.length,
            qualityScore: session.qualityScore,
          })),
          recommendations: generateOrganizationRecommendations(overviewAnalytics)
        });

      case 'session':
        // Get detailed metrics for a specific session
        if (!sessionId) {
          return NextResponse.json(
            { error: "Session ID is required for session analytics" },
            { status: 400 }
          );
        }

        const session = await clarificationDb.getSessionById(sessionId);
        if (!session) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        const sessionMetrics = qualityMetricsAnalyzer.calculateSessionMetrics(session);
        const recommendations = qualityMetricsAnalyzer.generateRecommendations(sessionMetrics);

        return NextResponse.json({
          session,
          metrics: sessionMetrics,
          recommendations,
          insights: generateSessionInsights(sessionMetrics)
        });

      case 'comparison':
        // Get before/after comparison metrics
        const beforeText = searchParams.get('beforeText');
        const afterText = searchParams.get('afterText');
        
        if (!beforeText || !afterText) {
          return NextResponse.json(
            { error: "Both beforeText and afterText are required for comparison" },
            { status: 400 }
          );
        }

        // Note: In a real implementation, assumptions would be retrieved from database
        const comparisonMetrics = qualityMetricsAnalyzer.calculateComparisonMetrics(
          beforeText,
          afterText,
          [], // Before assumptions - would be retrieved from database
          []  // After assumptions - would be retrieved from database
        );

        return NextResponse.json({
          comparison: comparisonMetrics,
          insights: generateComparisonInsights(comparisonMetrics)
        });

      default:
        return NextResponse.json(
          { error: "Invalid analytics type. Use 'overview', 'session', or 'comparison'" },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("Error retrieving clarification analytics:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Generate organization-level recommendations based on analytics
 */
function generateOrganizationRecommendations(analytics: any): string[] {
  const recommendations: string[] = [];
  
  if (analytics.completionRate < 0.7) {
    recommendations.push("Encourage users to complete more clarification questions - higher completion rates correlate with funding success");
  }
  
  if (analytics.avgQuestionsPerSession < 3) {
    recommendations.push("Consider providing guidance on question importance - successful applications typically address 3+ critical areas");
  }
  
  if (analytics.qualityImpact < 60) {
    recommendations.push("Focus on improving answer quality through better examples and guidance");
  }

  // Category-specific recommendations
  const topCategories = analytics.topCategories || [];
  const criticalCategories = ['budget', 'outcomes', 'methodology'];
  const missingCritical = criticalCategories.filter(cat => 
    !topCategories.find((tc: any) => tc.category === cat)
  );
  
  if (missingCritical.length > 0) {
    recommendations.push(`Address gaps in critical categories: ${missingCritical.join(', ')}`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Excellent clarification performance! Continue current practices for optimal results.");
  }

  return recommendations;
}

/**
 * Generate insights for session metrics
 */
function generateSessionInsights(metrics: any): string[] {
  const insights: string[] = [];
  
  if (metrics.sessionCompletionRate >= 0.9) {
    insights.push("Excellent completion rate! This level of detail significantly improves funding prospects.");
  } else if (metrics.sessionCompletionRate >= 0.7) {
    insights.push("Good completion rate. Consider addressing remaining questions for maximum impact.");
  } else {
    insights.push("Low completion rate may impact application strength. Prioritize critical questions.");
  }

  if (metrics.responseSpecificity >= 0.7) {
    insights.push("High specificity score indicates strong, detailed responses that reviewers value.");
  } else if (metrics.responseSpecificity >= 0.4) {
    insights.push("Moderate specificity. Adding more concrete numbers and examples would strengthen responses.");
  } else {
    insights.push("Low specificity score. Include more specific data, dates, and measurable details.");
  }

  if (metrics.evidenceProvided >= 0.6) {
    insights.push("Strong evidence integration demonstrates thorough preparation and credibility.");
  } else {
    insights.push("Consider adding more supporting data and documentation to strengthen your case.");
  }

  // Category insights
  const strongCategories = Object.entries(metrics.categoryQuality)
    .filter(([_, quality]: [string, any]) => quality >= 0.8)
    .map(([category, _]) => category);
  
  const weakCategories = Object.entries(metrics.categoryQuality)
    .filter(([_, quality]: [string, any]) => quality < 0.5)
    .map(([category, _]) => category);

  if (strongCategories.length > 0) {
    insights.push(`Strongest areas: ${strongCategories.join(', ')} - excellent detail and confidence`);
  }

  if (weakCategories.length > 0) {
    insights.push(`Areas for improvement: ${weakCategories.join(', ')} - consider more detailed responses`);
  }

  return insights;
}

/**
 * Generate insights for comparison metrics
 */
function generateComparisonInsights(comparison: any): string[] {
  const insights: string[] = [];
  
  if (comparison.improvement.textLengthIncrease > 30) {
    insights.push("Significant content expansion - clarifications added substantial detail");
  }
  
  if (comparison.improvement.assumptionReduction > 40) {
    insights.push("Major reduction in assumptions - responses are now more evidence-based");
  }
  
  if (comparison.improvement.specificityImprovement > 50) {
    insights.push("Dramatic improvement in specificity - much stronger concrete details");
  }
  
  if (comparison.improvement.evidenceImprovement > 30) {
    insights.push("Enhanced evidence integration - stronger supporting documentation");
  }

  // Overall assessment
  const totalImprovement = (
    Math.max(comparison.improvement.textLengthIncrease, 0) +
    Math.max(comparison.improvement.assumptionReduction, 0) +
    Math.max(comparison.improvement.specificityImprovement, 0) +
    Math.max(comparison.improvement.evidenceImprovement, 0)
  ) / 4;

  if (totalImprovement > 50) {
    insights.push("Outstanding improvement! Clarifications significantly enhanced application quality.");
  } else if (totalImprovement > 25) {
    insights.push("Good improvement from clarifications. Application is notably stronger.");
  } else if (totalImprovement > 10) {
    insights.push("Moderate improvement. Additional clarifications could further strengthen the application.");
  } else {
    insights.push("Limited improvement detected. Consider providing more detailed clarification responses.");
  }

  return insights;
}