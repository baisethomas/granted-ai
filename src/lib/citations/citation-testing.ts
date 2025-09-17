/**
 * Citation Testing Framework
 * 
 * Comprehensive testing suite for citation accuracy, grounding quality,
 * and hallucination detection. Provides automated quality assurance
 * for the citation system.
 */

import { 
  CitationService 
} from './citation-service';
import { 
  CitationParser 
} from './citation-parser';
import { 
  ParagraphCitation, 
  CitationSource, 
  ValidationIssue,
  CitationContext,
  GroundingAnalysis 
} from './types';

export interface CitationTestSuite {
  name: string;
  tests: CitationTest[];
  thresholds: QualityThresholds;
}

export interface CitationTest {
  id: string;
  name: string;
  description: string;
  type: 'grounding' | 'accuracy' | 'hallucination' | 'coverage' | 'consistency';
  inputText: string;
  expectedSources?: string[];
  expectedCitations?: number;
  expectedGroundingScore?: number;
  availableContext: CitationContext[];
}

export interface QualityThresholds {
  minimumGroundingScore: number;      // 0.85
  minimumCitationAccuracy: number;    // 0.90
  maximumHallucinationRate: number;   // 0.10
  minimumCoverage: number;            // 0.80
  minimumConsistencyScore: number;    // 0.85
}

export interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  score: number;
  expectedScore?: number;
  actualCitations: CitationSource[];
  issues: ValidationIssue[];
  executionTime: number;
  details: {
    groundingQuality?: number;
    citationAccuracy?: number;
    hallucinationRisk?: 'low' | 'medium' | 'high';
    coverageScore?: number;
    consistencyScore?: number;
  };
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  overallScore: number;
  executionTime: number;
  thresholdsMet: boolean;
  testResults: TestResult[];
  summary: {
    groundingQuality: number;
    citationAccuracy: number;
    hallucinationRate: number;
    coverage: number;
    consistency: number;
  };
  recommendations: string[];
}

export class CitationTestingFramework {
  private citationService: CitationService;
  private citationParser: CitationParser;

  constructor(openaiApiKey?: string, supabaseUrl?: string, supabaseKey?: string) {
    this.citationService = new CitationService(supabaseUrl, supabaseKey, openaiApiKey);
    this.citationParser = new CitationParser();
  }

  /**
   * Run a complete test suite for citation quality
   */
  async runTestSuite(testSuite: CitationTestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const testResults: TestResult[] = [];

    console.log(`Starting citation test suite: ${testSuite.name}`);

    for (const test of testSuite.tests) {
      try {
        const result = await this.runSingleTest(test, testSuite.thresholds);
        testResults.push(result);
        console.log(`Test ${test.id}: ${result.passed ? 'PASSED' : 'FAILED'} (Score: ${result.score.toFixed(2)})`);
      } catch (error) {
        console.error(`Test ${test.id} failed with error:`, error);
        testResults.push({
          testId: test.id,
          testName: test.name,
          passed: false,
          score: 0,
          actualCitations: [],
          issues: [{
            type: 'potential_hallucination',
            severity: 'high',
            description: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          executionTime: 0,
          details: {}
        });
      }
    }

    const executionTime = Date.now() - startTime;
    const passedTests = testResults.filter(r => r.passed).length;
    const overallScore = testResults.length > 0 
      ? testResults.reduce((sum, r) => sum + r.score, 0) / testResults.length 
      : 0;

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(testResults);
    const thresholdsMet = this.checkThresholds(summary, testSuite.thresholds);
    const recommendations = this.generateRecommendations(summary, testSuite.thresholds);

    return {
      suiteName: testSuite.name,
      totalTests: testSuite.tests.length,
      passedTests,
      overallScore,
      executionTime,
      thresholdsMet,
      testResults,
      summary,
      recommendations
    };
  }

  /**
   * Run a single citation test
   */
  private async runSingleTest(test: CitationTest, thresholds: QualityThresholds): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Generate citations for the test text
      const citationResponse = await this.citationService.generateCitationsForParagraph({
        text: test.inputText,
        context: test.availableContext,
        paragraphId: `test-${test.id}`,
        position: 0
      });

      // Run type-specific validation
      let passed = false;
      let score = 0;
      let details: TestResult['details'] = {};

      switch (test.type) {
        case 'grounding':
          score = citationResponse.groundingQuality;
          passed = score >= (test.expectedGroundingScore || thresholds.minimumGroundingScore);
          details.groundingQuality = score;
          break;

        case 'accuracy':
          score = await this.testCitationAccuracy(citationResponse.citations, test);
          passed = score >= thresholds.minimumCitationAccuracy;
          details.citationAccuracy = score;
          break;

        case 'hallucination':
          const hallucinationResult = this.testHallucinationDetection(
            test.inputText, 
            citationResponse.citations,
            test.availableContext
          );
          score = 1 - hallucinationResult.hallucinationRate;
          passed = hallucinationResult.hallucinationRate <= thresholds.maximumHallucinationRate;
          details.hallucinationRisk = hallucinationResult.riskLevel;
          break;

        case 'coverage':
          score = this.testCitationCoverage(test.inputText, citationResponse.citations);
          passed = score >= thresholds.minimumCoverage;
          details.coverageScore = score;
          break;

        case 'consistency':
          score = await this.testCitationConsistency(citationResponse.citations);
          passed = score >= thresholds.minimumConsistencyScore;
          details.consistencyScore = score;
          break;
      }

      return {
        testId: test.id,
        testName: test.name,
        passed,
        score,
        expectedScore: this.getExpectedScore(test, thresholds),
        actualCitations: citationResponse.citations,
        issues: citationResponse.validationIssues,
        executionTime: Date.now() - startTime,
        details
      };

    } catch (error) {
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test citation accuracy against expected sources
   */
  private async testCitationAccuracy(
    citations: CitationSource[], 
    test: CitationTest
  ): Promise<number> {
    if (!test.expectedSources || test.expectedSources.length === 0) {
      return 1.0; // No expected sources defined
    }

    let correctCitations = 0;
    const expectedSourceSet = new Set(test.expectedSources);

    for (const citation of citations) {
      // Check if citation references expected sources
      const isCorrect = expectedSourceSet.has(citation.documentId) ||
        test.expectedSources.some(expected => 
          citation.sectionTitle?.includes(expected) ||
          citation.sourceText.includes(expected)
        );
      
      if (isCorrect) correctCitations++;
    }

    return citations.length > 0 ? correctCitations / citations.length : 0;
  }

  /**
   * Test for hallucination detection
   */
  private testHallucinationDetection(
    text: string,
    citations: CitationSource[],
    availableContext: CitationContext[]
  ): { hallucinationRate: number; riskLevel: 'low' | 'medium' | 'high' } {
    const parsed = this.citationParser.parseContent(text, availableContext);
    const factualClaims = parsed.paragraphs.flatMap(p => 
      p.claims.filter(c => c.needsCitation)
    );

    if (factualClaims.length === 0) {
      return { hallucinationRate: 0, riskLevel: 'low' };
    }

    // Count claims without adequate citation support
    let unsupportedClaims = 0;
    
    for (const claim of factualClaims) {
      const supportingCitations = citations.filter(citation => 
        citation.positionInParagraph >= claim.position.start - 50 &&
        citation.positionInParagraph <= claim.position.end + 50 &&
        citation.similarityScore >= 0.6
      );

      if (supportingCitations.length === 0) {
        unsupportedClaims++;
      }
    }

    const hallucinationRate = unsupportedClaims / factualClaims.length;
    const riskLevel: 'low' | 'medium' | 'high' = 
      hallucinationRate > 0.3 ? 'high' :
      hallucinationRate > 0.15 ? 'medium' : 'low';

    return { hallucinationRate, riskLevel };
  }

  /**
   * Test citation coverage
   */
  private testCitationCoverage(text: string, citations: CitationSource[]): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length === 0) return 1.0;

    let citedSentences = 0;
    
    for (const sentence of sentences) {
      const sentenceStart = text.indexOf(sentence);
      const sentenceEnd = sentenceStart + sentence.length;

      const hasCitation = citations.some(citation =>
        citation.positionInParagraph >= sentenceStart - 10 &&
        citation.positionInParagraph <= sentenceEnd + 10
      );

      if (hasCitation) citedSentences++;
    }

    return citedSentences / sentences.length;
  }

  /**
   * Test citation consistency
   */
  private async testCitationConsistency(citations: CitationSource[]): Promise<number> {
    if (citations.length < 2) return 1.0;

    let consistentPairs = 0;
    let totalPairs = 0;

    // Compare all pairs of citations
    for (let i = 0; i < citations.length; i++) {
      for (let j = i + 1; j < citations.length; j++) {
        const citation1 = citations[i];
        const citation2 = citations[j];

        totalPairs++;

        // Check for consistency in citation format and quality
        const formatConsistent = citation1.citationMethod === citation2.citationMethod;
        const qualityConsistent = Math.abs(citation1.similarityScore - citation2.similarityScore) < 0.3;

        if (formatConsistent && qualityConsistent) {
          consistentPairs++;
        }
      }
    }

    return totalPairs > 0 ? consistentPairs / totalPairs : 1.0;
  }

  /**
   * Calculate summary metrics from test results
   */
  private calculateSummaryMetrics(testResults: TestResult[]): TestSuiteResult['summary'] {
    const groundingTests = testResults.filter(r => r.details.groundingQuality !== undefined);
    const accuracyTests = testResults.filter(r => r.details.citationAccuracy !== undefined);
    const hallucinationTests = testResults.filter(r => r.details.hallucinationRisk !== undefined);
    const coverageTests = testResults.filter(r => r.details.coverageScore !== undefined);
    const consistencyTests = testResults.filter(r => r.details.consistencyScore !== undefined);

    return {
      groundingQuality: groundingTests.length > 0 
        ? groundingTests.reduce((sum, t) => sum + (t.details.groundingQuality || 0), 0) / groundingTests.length 
        : 0,
      citationAccuracy: accuracyTests.length > 0 
        ? accuracyTests.reduce((sum, t) => sum + (t.details.citationAccuracy || 0), 0) / accuracyTests.length 
        : 0,
      hallucinationRate: hallucinationTests.length > 0 
        ? hallucinationTests.filter(t => t.details.hallucinationRisk === 'high').length / hallucinationTests.length 
        : 0,
      coverage: coverageTests.length > 0 
        ? coverageTests.reduce((sum, t) => sum + (t.details.coverageScore || 0), 0) / coverageTests.length 
        : 0,
      consistency: consistencyTests.length > 0 
        ? consistencyTests.reduce((sum, t) => sum + (t.details.consistencyScore || 0), 0) / consistencyTests.length 
        : 0
    };
  }

  /**
   * Check if quality thresholds are met
   */
  private checkThresholds(summary: TestSuiteResult['summary'], thresholds: QualityThresholds): boolean {
    return summary.groundingQuality >= thresholds.minimumGroundingScore &&
           summary.citationAccuracy >= thresholds.minimumCitationAccuracy &&
           summary.hallucinationRate <= thresholds.maximumHallucinationRate &&
           summary.coverage >= thresholds.minimumCoverage &&
           summary.consistency >= thresholds.minimumConsistencyScore;
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(
    summary: TestSuiteResult['summary'], 
    thresholds: QualityThresholds
  ): string[] {
    const recommendations: string[] = [];

    if (summary.groundingQuality < thresholds.minimumGroundingScore) {
      recommendations.push(
        `Improve grounding quality (${(summary.groundingQuality * 100).toFixed(1)}% vs ${(thresholds.minimumGroundingScore * 100).toFixed(1)}% target). Enhance source matching algorithms.`
      );
    }

    if (summary.citationAccuracy < thresholds.minimumCitationAccuracy) {
      recommendations.push(
        `Improve citation accuracy (${(summary.citationAccuracy * 100).toFixed(1)}% vs ${(thresholds.minimumCitationAccuracy * 100).toFixed(1)}% target). Review source attribution logic.`
      );
    }

    if (summary.hallucinationRate > thresholds.maximumHallucinationRate) {
      recommendations.push(
        `Reduce hallucination rate (${(summary.hallucinationRate * 100).toFixed(1)}% vs ${(thresholds.maximumHallucinationRate * 100).toFixed(1)}% maximum). Strengthen fact-checking validation.`
      );
    }

    if (summary.coverage < thresholds.minimumCoverage) {
      recommendations.push(
        `Increase citation coverage (${(summary.coverage * 100).toFixed(1)}% vs ${(thresholds.minimumCoverage * 100).toFixed(1)}% target). Add more comprehensive source attribution.`
      );
    }

    if (summary.consistency < thresholds.minimumConsistencyScore) {
      recommendations.push(
        `Improve citation consistency (${(summary.consistency * 100).toFixed(1)}% vs ${(thresholds.minimumConsistencyScore * 100).toFixed(1)}% target). Standardize citation formats and quality.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All quality thresholds met! Citation system is performing well.');
    }

    return recommendations;
  }

  private getExpectedScore(test: CitationTest, thresholds: QualityThresholds): number {
    switch (test.type) {
      case 'grounding': return test.expectedGroundingScore || thresholds.minimumGroundingScore;
      case 'accuracy': return thresholds.minimumCitationAccuracy;
      case 'hallucination': return 1 - thresholds.maximumHallucinationRate;
      case 'coverage': return thresholds.minimumCoverage;
      case 'consistency': return thresholds.minimumConsistencyScore;
      default: return 0.8;
    }
  }

  /**
   * Create a standard test suite for grant writing quality
   */
  createStandardGrantWritingTestSuite(organizationId: string): CitationTestSuite {
    return {
      name: "Grant Writing Citation Quality",
      thresholds: {
        minimumGroundingScore: 0.85,
        minimumCitationAccuracy: 0.90,
        maximumHallucinationRate: 0.10,
        minimumCoverage: 0.80,
        minimumConsistencyScore: 0.85
      },
      tests: [
        {
          id: 'grounding-statistical',
          name: 'Statistical Claims Grounding',
          description: 'Test grounding quality for statistical claims',
          type: 'grounding',
          inputText: 'Our organization has served over 5,000 beneficiaries in the past year, achieving a 95% satisfaction rate.',
          expectedGroundingScore: 0.9,
          availableContext: [] // Would be populated with actual context
        },
        {
          id: 'accuracy-mission',
          name: 'Mission Statement Accuracy',
          description: 'Test citation accuracy for mission-related content',
          type: 'accuracy',
          inputText: 'Our mission is to provide comprehensive support services to underserved communities.',
          expectedSources: ['mission-statement', 'organization-profile'],
          availableContext: []
        },
        {
          id: 'hallucination-budget',
          name: 'Budget Hallucination Detection',
          description: 'Test detection of unsupported budget claims',
          type: 'hallucination',
          inputText: 'The total project budget is $250,000, with 80% allocated to direct services and 20% to administrative costs.',
          availableContext: []
        },
        {
          id: 'coverage-methods',
          name: 'Methodology Citation Coverage',
          description: 'Test citation coverage for methodology descriptions',
          type: 'coverage',
          inputText: 'Our evidence-based approach combines cognitive behavioral therapy with peer support groups. Research shows this method increases recovery rates by 40%.',
          availableContext: []
        },
        {
          id: 'consistency-outcomes',
          name: 'Outcomes Citation Consistency',
          description: 'Test consistency of outcome-related citations',
          type: 'consistency',
          inputText: 'Previous programs achieved 85% completion rates and 70% employment placement within six months.',
          availableContext: []
        }
      ]
    };
  }
}

/**
 * Utility function to run citation quality tests
 */
export async function runCitationQualityTest(
  organizationId: string,
  customTests?: CitationTest[]
): Promise<TestSuiteResult> {
  const framework = new CitationTestingFramework();
  let testSuite = framework.createStandardGrantWritingTestSuite(organizationId);
  
  if (customTests) {
    testSuite = {
      ...testSuite,
      tests: [...testSuite.tests, ...customTests]
    };
  }
  
  return await framework.runTestSuite(testSuite);
}