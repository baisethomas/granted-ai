import { NextRequest, NextResponse } from "next/server";
import { clarificationTestSuite } from "@/lib/clarifications/test-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const testType = searchParams.get('type') || 'comprehensive'; // 'comprehensive' or 'smoke'

    if (testType === 'smoke') {
      // Run quick smoke test
      const passed = await clarificationTestSuite.runSmokeTest();
      
      return NextResponse.json({
        testType: 'smoke',
        passed,
        message: passed 
          ? "✅ Smoke test passed - basic functionality working"
          : "❌ Smoke test failed - basic functionality not working",
        timestamp: new Date().toISOString()
      });
    }

    if (testType === 'comprehensive') {
      // Run full test suite
      const testResults = await clarificationTestSuite.runComprehensiveTests();
      
      return NextResponse.json({
        testType: 'comprehensive',
        overallScore: testResults.overallScore,
        passed: testResults.overallScore >= 70, // 70% pass threshold
        summary: {
          totalTests: testResults.results.length,
          passedTests: testResults.results.filter(r => r.passed).length,
          failedTests: testResults.results.filter(r => !r.passed).length,
        },
        results: testResults.results,
        recommendations: testResults.recommendations,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: "Invalid test type. Use 'smoke' or 'comprehensive'" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error running clarification tests:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ 
      error: message,
      testType: 'error',
      passed: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      testType = 'comprehensive',
      grantQuestions,
      organizationContext,
      expectedCategories,
      validationCriteria 
    } = body;

    // Custom test with provided data
    if (testType === 'custom' && grantQuestions && organizationContext) {
      const customTestResults = await runCustomValidationTest({
        grantQuestions,
        organizationContext,
        expectedCategories,
        validationCriteria
      });

      return NextResponse.json(customTestResults);
    }

    return NextResponse.json(
      { error: "Invalid request. For custom tests, provide testType='custom', grantQuestions, and organizationContext" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error running custom clarification test:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Run custom validation test with user-provided data
 */
async function runCustomValidationTest({
  grantQuestions,
  organizationContext,
  expectedCategories = [],
  validationCriteria = {}
}: {
  grantQuestions: string[];
  organizationContext: string;
  expectedCategories?: string[];
  validationCriteria?: any;
}) {
  try {
    const { ClarificationEngine } = await import("@/lib/clarifications/engine");
    const engine = new ClarificationEngine({ useRAG: false });

    const context = {
      grantQuestions,
      organizationId: "custom-test",
      availableDocuments: [],
      existingContext: organizationContext,
      tone: "professional"
    };

    // Generate clarification questions
    const questions = await engine.generateClarifications(context);

    // Validate results
    const validation = {
      questionCount: {
        generated: questions.length,
        expected: validationCriteria.expectedQuestionCount || '1-5',
        passed: questions.length >= 1 && questions.length <= 5
      },
      categoryRepresentation: {
        generated: [...new Set(questions.map(q => q.category))],
        expected: expectedCategories,
        passed: expectedCategories.length === 0 || 
                expectedCategories.some(cat => questions.some(q => q.category === cat))
      },
      questionQuality: {
        avgContextLength: questions.reduce((sum, q) => sum + q.context.length, 0) / Math.max(questions.length, 1),
        hasExamples: questions.filter(q => q.examples && q.examples.length > 0).length,
        hasCritical: questions.filter(q => q.priority === 'critical' || q.priority === 'high').length,
        passed: questions.every(q => q.context.length > 20 && q.question.length > 20)
      }
    };

    const overallPassed = validation.questionCount.passed && 
                          validation.categoryRepresentation.passed && 
                          validation.questionQuality.passed;

    return {
      testType: 'custom',
      passed: overallPassed,
      questions,
      validation,
      insights: generateCustomTestInsights(questions, validation),
      recommendations: generateCustomTestRecommendations(validation),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      testType: 'custom',
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate insights for custom tests
 */
function generateCustomTestInsights(questions: any[], validation: any): string[] {
  const insights: string[] = [];

  if (questions.length === 0) {
    insights.push("❌ No clarification questions were generated - context may be too complete or system may have issues");
  } else if (questions.length <= 2) {
    insights.push(`✅ Generated ${questions.length} focused questions - indicates good context coverage`);
  } else {
    insights.push(`⚠️ Generated ${questions.length} questions - may indicate significant gaps in provided context`);
  }

  const categories = [...new Set(questions.map(q => q.category))];
  if (categories.length > 0) {
    insights.push(`📊 Categories identified: ${categories.join(', ')}`);
  }

  const criticalQuestions = questions.filter(q => q.priority === 'critical' || q.priority === 'high').length;
  if (criticalQuestions > 0) {
    insights.push(`🚨 ${criticalQuestions} high-priority questions detected - these are critical for funding success`);
  }

  const avgContextLength = validation.questionQuality.avgContextLength;
  if (avgContextLength > 100) {
    insights.push("✅ Questions have detailed context explanations");
  } else {
    insights.push("⚠️ Questions have limited context - may need improvement");
  }

  return insights;
}

/**
 * Generate recommendations for custom tests
 */
function generateCustomTestRecommendations(validation: any): string[] {
  const recommendations: string[] = [];

  if (!validation.questionCount.passed) {
    recommendations.push("Review your organizational context - it may be too complete (no questions needed) or too sparse (system issues)");
  }

  if (!validation.categoryRepresentation.passed) {
    recommendations.push("Consider adding more detail to your context to trigger questions in expected categories");
  }

  if (!validation.questionQuality.passed) {
    recommendations.push("Question quality may need improvement - check system prompts and generation logic");
  }

  if (validation.questionQuality.hasCritical === 0) {
    recommendations.push("No critical priority questions generated - ensure gap analysis is identifying important missing information");
  }

  if (validation.questionQuality.hasExamples === 0) {
    recommendations.push("Questions lack examples - consider enhancing question generation to include helpful examples");
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Custom test passed successfully! The system is generating appropriate clarification questions.");
  }

  return recommendations;
}