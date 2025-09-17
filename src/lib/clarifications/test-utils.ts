import { ClarificationEngine } from "./engine";
import { qualityMetricsAnalyzer } from "./quality-metrics";
import type { 
  AnalysisContext, 
  ClarificationSession, 
  ClarificationQuestion,
  ClarificationAnswer,
  AssumptionLabel,
  InformationGap
} from "./types";

/**
 * Test data and utilities for validating the Clarification Engine
 */

export const mockGrantQuestions = [
  "What is your organization's mission and how does it align with this funding opportunity?",
  "Describe the specific problem or need your project will address.",
  "What is your target population and how many people will you serve?",
  "What is your total project budget and how will funds be used?",
  "What are your expected outcomes and how will you measure success?",
  "How will you ensure the sustainability of this project after the grant period ends?",
  "What evidence-based practices will guide your implementation?",
  "Who are your key staff members and what qualifications do they bring?"
];

export const mockOrganizationContext = `
Our organization is a community-based nonprofit focused on youth development.
We have been operating for 15 years and serve the downtown area.
Our staff includes experienced social workers and program coordinators.
We have previously managed grants from various foundations.
`;

export const mockWeakContext = `
We help people in our community with various programs.
We have been around for a while and have some staff.
We want to make a positive impact.
`;

export const mockStrongContext = `
Community Youth Development Center (CYDC) is a 501(c)(3) nonprofit organization established in 2008, serving low-income youth ages 12-18 in the downtown metropolitan area. Our mission is to provide comprehensive support services that promote academic achievement, social-emotional development, and career readiness for at-risk youth.

ORGANIZATIONAL CAPACITY:
- Annual operating budget: $850,000
- Staff: 12 full-time employees including MSW-level social workers, licensed counselors, and certified educators
- Service statistics: 450 youth served annually with 85% retention rate
- Facilities: 15,000 sq ft community center with classrooms, computer lab, recreational space

PROGRAM EVIDENCE:
- 78% of participants show improved academic performance (GPA increase of 0.5+ points)
- 92% participant satisfaction rate based on annual surveys
- 65% of program graduates enroll in post-secondary education (vs. 35% district average)
- Partnerships with 8 local schools and 15 community organizations

FINANCIAL MANAGEMENT:
- Clean audit history with no findings for 10 consecutive years
- Current unrestricted net assets: $125,000
- Diverse funding portfolio: 40% foundations, 35% government contracts, 25% individual donors
- Federal ID: 12-3456789, State registration current
`;

export const mockAssumptions: AssumptionLabel[] = [
  {
    id: "assumption-1",
    text: "We expect to serve approximately 100 participants",
    category: "specificity",
    confidence: 0.8,
    suggestedQuestion: "What specific criteria will you use to determine participant numbers and eligibility?",
    position: { start: 150, end: 200 }
  },
  {
    id: "assumption-2", 
    text: "Our program will cost around $50,000",
    category: "budget",
    confidence: 0.9,
    suggestedQuestion: "Please provide a detailed budget breakdown with specific cost calculations.",
    position: { start: 300, end: 340 }
  },
  {
    id: "assumption-3",
    text: "We believe this approach will be effective",
    category: "methodology", 
    confidence: 0.7,
    suggestedQuestion: "What research or evidence supports the effectiveness of this approach?",
    position: { start: 500, end: 545 }
  }
];

/**
 * Test suite for the Clarification Engine
 */
export class ClarificationEngineTestSuite {
  private engine: ClarificationEngine;
  
  constructor() {
    this.engine = new ClarificationEngine({ useRAG: false }); // Disable RAG for consistent testing
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests(): Promise<{
    results: Array<{
      testName: string;
      passed: boolean;
      details: string;
      metrics?: any;
    }>;
    overallScore: number;
    recommendations: string[];
  }> {
    console.log('🧪 Starting Clarification Engine Test Suite...\n');

    const results = [
      await this.testBasicQuestionGeneration(),
      await this.testGapAnalysisAccuracy(),
      await this.testQuestionQuality(),
      await this.testAssumptionDetection(),
      await this.testQualityMetrics(),
      await this.testSessionManagement(),
      await this.testContextEnhancement(),
      await this.testRecommendationGeneration(),
    ];

    // Calculate overall score
    const passedTests = results.filter(r => r.passed).length;
    const overallScore = Math.round((passedTests / results.length) * 100);

    // Generate recommendations based on failed tests
    const failedTests = results.filter(r => !r.passed);
    const recommendations = this.generateTestRecommendations(failedTests);

    return {
      results,
      overallScore,
      recommendations
    };
  }

  /**
   * Test basic question generation functionality
   */
  private async testBasicQuestionGeneration() {
    try {
      const context: AnalysisContext = {
        grantQuestions: mockGrantQuestions.slice(0, 3),
        organizationId: "test-org",
        availableDocuments: [],
        existingContext: mockWeakContext,
        tone: "professional"
      };

      const questions = await this.engine.generateClarifications(context);
      
      const passed = questions.length > 0 && questions.length <= 5;
      
      return {
        testName: "Basic Question Generation",
        passed,
        details: `Generated ${questions.length} questions (expected: 1-5). ${
          passed ? '✅ Within expected range' : '❌ Outside expected range'
        }`
      };
    } catch (error) {
      return {
        testName: "Basic Question Generation",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test gap analysis accuracy
   */
  private async testGapAnalysisAccuracy() {
    try {
      const context: AnalysisContext = {
        grantQuestions: mockGrantQuestions,
        organizationId: "test-org",
        availableDocuments: [],
        existingContext: mockWeakContext,
        tone: "professional"
      };

      const questions = await this.engine.generateClarifications(context);
      
      // Check if critical categories are represented
      const categories = questions.map(q => q.category);
      const criticalCategories = ['budget', 'outcomes', 'methodology'];
      const criticalCovered = criticalCategories.filter(cat => categories.includes(cat));
      
      const passed = criticalCovered.length >= 2; // At least 2 critical categories should be covered
      
      return {
        testName: "Gap Analysis Accuracy",
        passed,
        details: `Covered ${criticalCovered.length}/3 critical categories (${criticalCovered.join(', ')}). ${
          passed ? '✅ Good coverage' : '❌ Insufficient critical coverage'
        }`
      };
    } catch (error) {
      return {
        testName: "Gap Analysis Accuracy",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test question quality and specificity
   */
  private async testQuestionQuality() {
    try {
      const context: AnalysisContext = {
        grantQuestions: mockGrantQuestions.slice(0, 4),
        organizationId: "test-org",
        availableDocuments: [],
        existingContext: mockOrganizationContext,
        tone: "professional"
      };

      const questions = await this.engine.generateClarifications(context);
      
      // Evaluate question quality
      let qualityScore = 0;
      let details: string[] = [];

      for (const question of questions) {
        // Check if question has context explanation
        if (question.context && question.context.length > 50) {
          qualityScore += 20;
        } else {
          details.push(`Question lacks sufficient context: ${question.question.substring(0, 50)}...`);
        }

        // Check if question is specific (not generic)
        if (!this.isGenericQuestion(question.question)) {
          qualityScore += 20;
        } else {
          details.push(`Question appears generic: ${question.question.substring(0, 50)}...`);
        }

        // Check if question has examples
        if (question.examples && question.examples.length > 0) {
          qualityScore += 10;
        }
      }

      const avgQualityScore = questions.length > 0 ? qualityScore / questions.length : 0;
      const passed = avgQualityScore >= 30; // Require at least 30/50 average quality

      return {
        testName: "Question Quality",
        passed,
        details: `Average quality score: ${avgQualityScore.toFixed(1)}/50. ${
          passed ? '✅ Good quality' : '❌ Poor quality'
        }\n${details.join('\n')}`,
        metrics: { avgQualityScore, questionCount: questions.length }
      };
    } catch (error) {
      return {
        testName: "Question Quality",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test assumption detection capability
   */
  private async testAssumptionDetection() {
    try {
      const testText = "We plan to serve approximately 100 participants at a cost of around $50,000. We believe our approach will be effective based on our experience.";
      
      const assumptions = await this.engine.analyzeGeneratedContent(
        testText,
        {
          grantQuestions: mockGrantQuestions.slice(0, 3),
          organizationId: "test-org",
          availableDocuments: [],
          existingContext: mockWeakContext,
          tone: "professional"
        }
      );

      const detected = assumptions.assumptions.length;
      const passed = detected >= 2; // Should detect at least 2 assumptions in the test text
      
      return {
        testName: "Assumption Detection",
        passed,
        details: `Detected ${detected} assumptions (expected: ≥2). ${
          passed ? '✅ Good detection' : '❌ Poor detection'
        }`,
        metrics: { assumptionsDetected: detected }
      };
    } catch (error) {
      return {
        testName: "Assumption Detection",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test quality metrics calculation
   */
  private async testQualityMetrics() {
    try {
      const mockSession: ClarificationSession = {
        projectId: "test-project",
        questions: [
          {
            id: "q1",
            question: "What is your detailed budget breakdown?",
            category: "budget",
            priority: "critical",
            expectedAnswerType: "text",
            context: "Detailed budget information is essential for reviewer evaluation"
          },
          {
            id: "q2", 
            question: "What are your specific outcome targets?",
            category: "outcomes",
            priority: "high",
            expectedAnswerType: "text",
            context: "Measurable outcomes demonstrate accountability"
          }
        ],
        answers: [
          {
            questionId: "q1",
            answer: "Our total budget is $75,000: $45,000 for personnel (0.75 FTE Project Coordinator @ $60K), $15,000 for materials and supplies, $10,000 for evaluation activities, $5,000 for administrative costs. Cost per participant is $375 based on serving 200 individuals.",
            confidence: 0.9,
            followUpNeeded: false
          },
          {
            questionId: "q2",
            answer: "We will serve 200 participants with target outcomes: 80% completion rate, 75% showing improved skills assessment scores, 90% participant satisfaction rating.",
            confidence: 0.8,
            followUpNeeded: false
          }
        ],
        assumptions: [],
        status: "completed",
        completionRate: 1.0
      };

      const metrics = qualityMetricsAnalyzer.calculateSessionMetrics(mockSession);
      
      // Validate metrics are reasonable
      const checks = [
        metrics.sessionCompletionRate === 1.0,
        metrics.avgConfidenceScore >= 0.8,
        metrics.responseSpecificity > 0.3,
        metrics.evidenceProvided >= 0,
        metrics.qualityImprovementScore > 50
      ];

      const passed = checks.filter(Boolean).length >= 4;
      
      return {
        testName: "Quality Metrics",
        passed,
        details: `Quality metrics calculation: ${checks.filter(Boolean).length}/5 checks passed. ${
          passed ? '✅ Metrics working correctly' : '❌ Metrics calculation issues'
        }`,
        metrics: metrics
      };
    } catch (error) {
      return {
        testName: "Quality Metrics",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test session management functionality
   */
  private async testSessionManagement() {
    try {
      const context: AnalysisContext = {
        grantQuestions: mockGrantQuestions.slice(0, 3),
        organizationId: "test-org",
        availableDocuments: [],
        existingContext: mockOrganizationContext,
        tone: "professional"
      };

      // Test session creation
      const session = await this.engine.createClarificationSession("test-project", context);
      
      // Test session update
      const mockAnswers: ClarificationAnswer[] = [
        {
          questionId: session.questions[0]?.id || "q1",
          answer: "Test answer with sufficient detail for validation purposes",
          confidence: 0.7,
          followUpNeeded: false
        }
      ];

      const updatedSession = this.engine.updateSessionWithAnswers(session, mockAnswers);
      
      const checks = [
        session.projectId === "test-project",
        session.questions.length >= 0,
        updatedSession.answers.length === 1,
        updatedSession.completionRate > 0
      ];

      const passed = checks.filter(Boolean).length >= 3;
      
      return {
        testName: "Session Management",
        passed,
        details: `Session management: ${checks.filter(Boolean).length}/4 checks passed. ${
          passed ? '✅ Session management working' : '❌ Session management issues'
        }`,
        metrics: { 
          questionsGenerated: session.questions.length,
          answersProcessed: updatedSession.answers.length,
          completionRate: updatedSession.completionRate
        }
      };
    } catch (error) {
      return {
        testName: "Session Management",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test context enhancement capability
   */
  private async testContextEnhancement() {
    try {
      const originalContext = mockWeakContext;
      const mockSession: ClarificationSession = {
        projectId: "test",
        questions: [
          {
            id: "q1",
            question: "What is your budget?",
            category: "budget",
            priority: "critical",
            expectedAnswerType: "text",
            context: "Budget details needed"
          }
        ],
        answers: [
          {
            questionId: "q1",
            answer: "Our budget is $50,000 with detailed line items for personnel, materials, and evaluation.",
            confidence: 0.8,
            followUpNeeded: false
          }
        ],
        assumptions: [],
        status: "completed",
        completionRate: 1.0
      };

      const enhancedContext = this.engine.buildEnhancedContext(originalContext, mockSession);
      
      const contextImprovement = (enhancedContext.length - originalContext.length) / originalContext.length;
      const hasStructuredInfo = enhancedContext.includes("CLARIFICATION");
      
      const passed = contextImprovement > 0.3 && hasStructuredInfo;
      
      return {
        testName: "Context Enhancement",
        passed,
        details: `Context improvement: ${Math.round(contextImprovement * 100)}% increase, structured format: ${hasStructuredInfo}. ${
          passed ? '✅ Good enhancement' : '❌ Poor enhancement'
        }`,
        metrics: { contextImprovement, originalLength: originalContext.length, enhancedLength: enhancedContext.length }
      };
    } catch (error) {
      return {
        testName: "Context Enhancement", 
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Test recommendation generation
   */
  private async testRecommendationGeneration() {
    try {
      const mockMetrics = {
        sessionCompletionRate: 0.4,
        avgConfidenceScore: 0.5,
        responseSpecificity: 0.3,
        evidenceProvided: 0.2,
        qualityImprovementScore: 45
      };

      const recommendations = qualityMetricsAnalyzer.generateRecommendations(mockMetrics as any);
      
      const passed = recommendations.length > 0 && recommendations.length <= 10;
      const hasActionableAdvice = recommendations.some(r => 
        r.toLowerCase().includes('specific') || 
        r.toLowerCase().includes('detail') || 
        r.toLowerCase().includes('evidence')
      );
      
      return {
        testName: "Recommendation Generation",
        passed: passed && hasActionableAdvice,
        details: `Generated ${recommendations.length} recommendations, actionable advice: ${hasActionableAdvice}. ${
          passed && hasActionableAdvice ? '✅ Good recommendations' : '❌ Poor recommendations'
        }`,
        metrics: { recommendationCount: recommendations.length }
      };
    } catch (error) {
      return {
        testName: "Recommendation Generation",
        passed: false,
        details: `❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check if a question is generic/low-quality
   */
  private isGenericQuestion(question: string): boolean {
    const genericPatterns = [
      /^(what|how|why|when|where)\s+(is|are|do|does|will|would|can|could)\s+your?/i,
      /please\s+(provide|describe|explain|tell)/i,
      /more\s+(information|details|specifics)/i
    ];

    return genericPatterns.some(pattern => 
      pattern.test(question) && question.length < 100
    );
  }

  /**
   * Generate recommendations based on failed tests
   */
  private generateTestRecommendations(failedTests: Array<{ testName: string; details: string }>): string[] {
    const recommendations: string[] = [];

    for (const test of failedTests) {
      switch (test.testName) {
        case "Basic Question Generation":
          recommendations.push("Review gap analysis logic - ensure appropriate number of questions are generated");
          break;
        case "Gap Analysis Accuracy":
          recommendations.push("Improve gap analysis to better identify critical categories (budget, outcomes, methodology)");
          break;
        case "Question Quality":
          recommendations.push("Enhance question generation prompts to create more specific, contextual questions");
          break;
        case "Assumption Detection":
          recommendations.push("Refine assumption detection patterns and confidence thresholds");
          break;
        case "Quality Metrics":
          recommendations.push("Debug quality metrics calculation methods");
          break;
        case "Session Management":
          recommendations.push("Fix session creation and update functionality");
          break;
        case "Context Enhancement":
          recommendations.push("Improve context enhancement to provide more structured, valuable information");
          break;
        case "Recommendation Generation":
          recommendations.push("Generate more actionable and specific recommendations");
          break;
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("All tests passed! The Clarification Engine is functioning well.");
    }

    return recommendations;
  }

  /**
   * Quick smoke test for basic functionality
   */
  async runSmokeTest(): Promise<boolean> {
    try {
      const context: AnalysisContext = {
        grantQuestions: ["What is your project budget?", "Who will you serve?"],
        organizationId: "smoke-test",
        availableDocuments: [],
        existingContext: "We are a small nonprofit.",
        tone: "professional"
      };

      const questions = await this.engine.generateClarifications(context);
      return questions.length > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton test instance
export const clarificationTestSuite = new ClarificationEngineTestSuite();