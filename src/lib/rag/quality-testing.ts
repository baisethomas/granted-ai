import { VectorRetrievalService, ChunkWithSimilarity } from './retrieval';
import { EmbeddingService } from './embeddings';
import { DocumentChunker } from './chunking';
import { ContextRankingService } from './ranking';

export interface TestQuery {
  id: string;
  question: string;
  questionType?: string;
  expectedChunks?: string[]; // IDs of chunks that should be retrieved
  expectedSources?: string[]; // Document IDs that should be represented
  minimumSimilarity?: number;
  expectedRelevantTopics?: string[];
}

export interface RetrievalTestResult {
  queryId: string;
  query: string;
  retrievedChunks: ChunkWithSimilarity[];
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    averageSimilarity: number;
    diversityScore: number;
    sourceCoverage: number;
    relevanceScore: number;
  };
  qualityIssues: string[];
  recommendations: string[];
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  queries: TestQuery[];
  organizationId: string;
}

export interface QualityMetrics {
  averagePrecision: number;
  averageRecall: number;
  averageF1: number;
  averageSimilarity: number;
  averageDiversity: number;
  overallScore: number; // Weighted combination of metrics
  passingQueries: number;
  totalQueries: number;
  passRate: number;
}

export class QualityTestingFramework {
  private retrievalService: VectorRetrievalService;
  private embeddingService: EmbeddingService;
  private chunker: DocumentChunker;
  private rankingService: ContextRankingService;
  
  private readonly qualityThresholds = {
    minimumSimilarity: 0.7,
    minimumDiversity: 0.3,
    minimumSourceCoverage: 0.5,
    minimumRelevance: 0.6,
    passScore: 0.75,
  };

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.retrievalService = new VectorRetrievalService(this.embeddingService);
    this.chunker = new DocumentChunker();
    this.rankingService = new ContextRankingService();
  }

  /**
   * Run a comprehensive test suite
   */
  public async runTestSuite(testSuite: TestSuite): Promise<{
    results: RetrievalTestResult[];
    overallMetrics: QualityMetrics;
    report: string;
  }> {
    console.log(`Running test suite: ${testSuite.name}`);
    
    const results: RetrievalTestResult[] = [];
    
    // Run each test query
    for (const query of testSuite.queries) {
      try {
        const result = await this.runSingleTest(query, testSuite.organizationId);
        results.push(result);
        console.log(`Query ${query.id}: ${result.metrics.f1Score.toFixed(3)} F1 score`);
      } catch (error: any) {
        console.error(`Test query ${query.id} failed:`, error);
        
        // Add failed result
        results.push({
          queryId: query.id,
          query: query.question,
          retrievedChunks: [],
          metrics: {
            precision: 0,
            recall: 0,
            f1Score: 0,
            averageSimilarity: 0,
            diversityScore: 0,
            sourceCoverage: 0,
            relevanceScore: 0,
          },
          qualityIssues: [`Test execution failed: ${error.message}`],
          recommendations: ['Check system configuration and data availability'],
        });
      }
    }
    
    // Calculate overall metrics
    const overallMetrics = this.calculateOverallMetrics(results);
    
    // Generate report
    const report = this.generateReport(testSuite, results, overallMetrics);
    
    return { results, overallMetrics, report };
  }

  /**
   * Run a single test query
   */
  private async runSingleTest(
    testQuery: TestQuery,
    organizationId: string
  ): Promise<RetrievalTestResult> {
    // Perform retrieval
    const retrievalResult = await this.retrievalService.hybridSearch(
      testQuery.question,
      {
        organizationId,
        limit: 8,
        similarityThreshold: 0.6,
        diversityFactor: 0.3,
      }
    );

    const retrievedChunks = retrievalResult.chunks;
    
    // Calculate metrics
    const metrics = this.calculateMetrics(testQuery, retrievedChunks);
    
    // Identify quality issues
    const qualityIssues = this.identifyQualityIssues(testQuery, retrievedChunks, metrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(qualityIssues, metrics);

    return {
      queryId: testQuery.id,
      query: testQuery.question,
      retrievedChunks,
      metrics,
      qualityIssues,
      recommendations,
    };
  }

  /**
   * Calculate precision, recall, and other metrics
   */
  private calculateMetrics(
    testQuery: TestQuery,
    retrievedChunks: ChunkWithSimilarity[]
  ): RetrievalTestResult['metrics'] {
    const retrievedIds = new Set(retrievedChunks.map(c => c.id));
    const expectedIds = new Set(testQuery.expectedChunks || []);
    const retrievedSources = new Set(retrievedChunks.map(c => c.documentId));
    const expectedSources = new Set(testQuery.expectedSources || []);

    // Precision and Recall
    const truePositives = new Set([...retrievedIds].filter(id => expectedIds.has(id))).size;
    const precision = retrievedIds.size > 0 ? truePositives / retrievedIds.size : 0;
    const recall = expectedIds.size > 0 ? truePositives / expectedIds.size : 1;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Average similarity
    const averageSimilarity = retrievedChunks.length > 0 
      ? retrievedChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / retrievedChunks.length
      : 0;

    // Diversity score (based on unique documents and sections)
    const uniqueDocuments = retrievedSources.size;
    const uniqueSections = new Set(retrievedChunks.map(c => c.sectionTitle || 'general')).size;
    const diversityScore = retrievedChunks.length > 0 
      ? (uniqueDocuments + uniqueSections) / (retrievedChunks.length * 2)
      : 0;

    // Source coverage
    const sourceCoverage = expectedSources.size > 0
      ? new Set([...retrievedSources].filter(s => expectedSources.has(s))).size / expectedSources.size
      : 1;

    // Relevance score (based on content analysis)
    const relevanceScore = this.calculateRelevanceScore(testQuery, retrievedChunks);

    return {
      precision,
      recall,
      f1Score,
      averageSimilarity,
      diversityScore,
      sourceCoverage,
      relevanceScore,
    };
  }

  /**
   * Calculate relevance score based on content analysis
   */
  private calculateRelevanceScore(
    testQuery: TestQuery,
    retrievedChunks: ChunkWithSimilarity[]
  ): number {
    if (retrievedChunks.length === 0) return 0;

    let relevanceSum = 0;
    const queryLower = testQuery.question.toLowerCase();
    const expectedTopics = testQuery.expectedRelevantTopics || [];

    for (const chunk of retrievedChunks) {
      let chunkRelevance = chunk.similarity; // Base relevance from similarity

      const content = chunk.content.toLowerCase();
      const sectionTitle = (chunk.sectionTitle || '').toLowerCase();

      // Boost for exact query terms
      const queryWords = queryLower.split(/\s+/).filter(word => word.length > 3);
      const matchingWords = queryWords.filter(word => content.includes(word) || sectionTitle.includes(word));
      chunkRelevance += (matchingWords.length / queryWords.length) * 0.2;

      // Boost for expected topics
      if (expectedTopics.length > 0) {
        const topicMatches = expectedTopics.filter(topic => 
          content.includes(topic.toLowerCase()) || sectionTitle.includes(topic.toLowerCase())
        );
        chunkRelevance += (topicMatches.length / expectedTopics.length) * 0.2;
      }

      // Penalty for very short chunks (often less informative)
      if (chunk.content.length < 100) {
        chunkRelevance -= 0.1;
      }

      relevanceSum += Math.min(1, chunkRelevance);
    }

    return relevanceSum / retrievedChunks.length;
  }

  /**
   * Identify quality issues with the retrieval
   */
  private identifyQualityIssues(
    testQuery: TestQuery,
    retrievedChunks: ChunkWithSimilarity[],
    metrics: RetrievalTestResult['metrics']
  ): string[] {
    const issues: string[] = [];

    if (retrievedChunks.length === 0) {
      issues.push('No chunks retrieved for query');
      return issues;
    }

    if (metrics.precision < 0.5) {
      issues.push('Low precision: many irrelevant chunks retrieved');
    }

    if (metrics.recall < 0.5) {
      issues.push('Low recall: missing expected relevant chunks');
    }

    if (metrics.averageSimilarity < this.qualityThresholds.minimumSimilarity) {
      issues.push(`Low average similarity (${metrics.averageSimilarity.toFixed(3)})`);
    }

    if (metrics.diversityScore < this.qualityThresholds.minimumDiversity) {
      issues.push('Low diversity: too many chunks from same source');
    }

    if (metrics.sourceCoverage < this.qualityThresholds.minimumSourceCoverage) {
      issues.push('Poor source coverage: missing expected sources');
    }

    if (metrics.relevanceScore < this.qualityThresholds.minimumRelevance) {
      issues.push('Low content relevance to query');
    }

    // Check for very short chunks
    const shortChunks = retrievedChunks.filter(c => c.content.length < 100);
    if (shortChunks.length > retrievedChunks.length / 3) {
      issues.push('Too many very short chunks (< 100 characters)');
    }

    // Check for very long chunks
    const longChunks = retrievedChunks.filter(c => c.content.length > 2000);
    if (longChunks.length > retrievedChunks.length / 2) {
      issues.push('Too many very long chunks (> 2000 characters)');
    }

    return issues;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    issues: string[],
    metrics: RetrievalTestResult['metrics']
  ): string[] {
    const recommendations: string[] = [];

    if (issues.includes('No chunks retrieved for query')) {
      recommendations.push('Check if documents are processed and embeddings generated');
      recommendations.push('Verify organization has relevant content uploaded');
      recommendations.push('Lower similarity threshold for broader retrieval');
    }

    if (issues.some(i => i.includes('Low precision'))) {
      recommendations.push('Increase similarity threshold to filter irrelevant chunks');
      recommendations.push('Improve keyword matching in hybrid search');
      recommendations.push('Review document chunking strategy');
    }

    if (issues.some(i => i.includes('Low recall'))) {
      recommendations.push('Lower similarity threshold to retrieve more chunks');
      recommendations.push('Increase retrieval limit');
      recommendations.push('Review embedding quality for expected chunks');
    }

    if (issues.some(i => i.includes('Low average similarity'))) {
      recommendations.push('Review embedding model performance');
      recommendations.push('Check query preprocessing and normalization');
    }

    if (issues.some(i => i.includes('Low diversity'))) {
      recommendations.push('Increase diversity factor in retrieval options');
      recommendations.push('Ensure diverse document types are available');
    }

    if (issues.some(i => i.includes('Poor source coverage'))) {
      recommendations.push('Upload and process more relevant documents');
      recommendations.push('Review document categorization');
    }

    if (issues.some(i => i.includes('very short chunks'))) {
      recommendations.push('Adjust minimum chunk size in chunking options');
      recommendations.push('Filter out chunks below minimum quality threshold');
    }

    if (issues.some(i => i.includes('very long chunks'))) {
      recommendations.push('Reduce maximum chunk size in chunking options');
      recommendations.push('Improve document structure detection');
    }

    return recommendations;
  }

  /**
   * Calculate overall metrics across all test results
   */
  private calculateOverallMetrics(results: RetrievalTestResult[]): QualityMetrics {
    if (results.length === 0) {
      return {
        averagePrecision: 0,
        averageRecall: 0,
        averageF1: 0,
        averageSimilarity: 0,
        averageDiversity: 0,
        overallScore: 0,
        passingQueries: 0,
        totalQueries: 0,
        passRate: 0,
      };
    }

    const averagePrecision = results.reduce((sum, r) => sum + r.metrics.precision, 0) / results.length;
    const averageRecall = results.reduce((sum, r) => sum + r.metrics.recall, 0) / results.length;
    const averageF1 = results.reduce((sum, r) => sum + r.metrics.f1Score, 0) / results.length;
    const averageSimilarity = results.reduce((sum, r) => sum + r.metrics.averageSimilarity, 0) / results.length;
    const averageDiversity = results.reduce((sum, r) => sum + r.metrics.diversityScore, 0) / results.length;

    // Overall score is weighted combination of key metrics
    const overallScore = (
      averageF1 * 0.4 +
      averageSimilarity * 0.3 +
      averageDiversity * 0.2 +
      averagePrecision * 0.1
    );

    const passingQueries = results.filter(r => r.metrics.f1Score >= this.qualityThresholds.passScore).length;
    const passRate = passingQueries / results.length;

    return {
      averagePrecision,
      averageRecall,
      averageF1,
      averageSimilarity,
      averageDiversity,
      overallScore,
      passingQueries,
      totalQueries: results.length,
      passRate,
    };
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(
    testSuite: TestSuite,
    results: RetrievalTestResult[],
    overallMetrics: QualityMetrics
  ): string {
    const report = [];
    
    report.push(`# RAG Quality Test Report`);
    report.push(`Test Suite: ${testSuite.name}`);
    report.push(`Description: ${testSuite.description}`);
    report.push(`Organization ID: ${testSuite.organizationId}`);
    report.push(`Date: ${new Date().toISOString()}`);
    report.push('');
    
    // Overall metrics
    report.push('## Overall Metrics');
    report.push(`- Overall Score: ${(overallMetrics.overallScore * 100).toFixed(1)}%`);
    report.push(`- Pass Rate: ${(overallMetrics.passRate * 100).toFixed(1)}% (${overallMetrics.passingQueries}/${overallMetrics.totalQueries})`);
    report.push(`- Average F1 Score: ${(overallMetrics.averageF1 * 100).toFixed(1)}%`);
    report.push(`- Average Precision: ${(overallMetrics.averagePrecision * 100).toFixed(1)}%`);
    report.push(`- Average Recall: ${(overallMetrics.averageRecall * 100).toFixed(1)}%`);
    report.push(`- Average Similarity: ${(overallMetrics.averageSimilarity * 100).toFixed(1)}%`);
    report.push(`- Average Diversity: ${(overallMetrics.averageDiversity * 100).toFixed(1)}%`);
    report.push('');

    // Status summary
    const grade = overallMetrics.overallScore >= 0.85 ? 'Excellent' :
                 overallMetrics.overallScore >= 0.75 ? 'Good' :
                 overallMetrics.overallScore >= 0.65 ? 'Fair' : 'Needs Improvement';
    
    report.push(`## Overall Assessment: ${grade}`);
    report.push('');

    // Individual query results
    report.push('## Individual Query Results');
    
    for (const result of results) {
      const status = result.metrics.f1Score >= this.qualityThresholds.passScore ? 'PASS' : 'FAIL';
      
      report.push(`### Query ${result.queryId} [${status}]`);
      report.push(`**Question:** ${result.query}`);
      report.push(`**F1 Score:** ${(result.metrics.f1Score * 100).toFixed(1)}%`);
      report.push(`**Chunks Retrieved:** ${result.retrievedChunks.length}`);
      
      if (result.qualityIssues.length > 0) {
        report.push('**Issues:**');
        for (const issue of result.qualityIssues) {
          report.push(`- ${issue}`);
        }
      }
      
      if (result.recommendations.length > 0) {
        report.push('**Recommendations:**');
        for (const rec of result.recommendations) {
          report.push(`- ${rec}`);
        }
      }
      
      report.push('');
    }

    // Common issues and recommendations
    const allIssues = results.flatMap(r => r.qualityIssues);
    const allRecommendations = results.flatMap(r => r.recommendations);
    
    const issueFreq = this.getFrequency(allIssues);
    const recFreq = this.getFrequency(allRecommendations);
    
    if (Object.keys(issueFreq).length > 0) {
      report.push('## Most Common Issues');
      Object.entries(issueFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([issue, count]) => {
          report.push(`- ${issue} (${count} queries)`);
        });
      report.push('');
    }
    
    if (Object.keys(recFreq).length > 0) {
      report.push('## Top Recommendations');
      Object.entries(recFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([rec, count]) => {
          report.push(`- ${rec} (suggested ${count} times)`);
        });
      report.push('');
    }

    return report.join('\n');
  }

  /**
   * Get frequency map of items
   */
  private getFrequency(items: string[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const item of items) {
      freq[item] = (freq[item] || 0) + 1;
    }
    return freq;
  }

  /**
   * Create standard test queries for grant writing
   */
  public createStandardTestSuite(organizationId: string): TestSuite {
    return {
      id: 'standard-grant-writing',
      name: 'Standard Grant Writing Test Suite',
      description: 'Comprehensive test suite for grant writing RAG system',
      organizationId,
      queries: [
        {
          id: 'mission-1',
          question: 'What is your organization\'s mission statement?',
          questionType: 'mission',
          expectedRelevantTopics: ['mission', 'vision', 'purpose', 'values'],
          minimumSimilarity: 0.7,
        },
        {
          id: 'needs-1',
          question: 'What specific problem does your organization address in the community?',
          questionType: 'needs',
          expectedRelevantTopics: ['problem', 'need', 'challenge', 'community'],
          minimumSimilarity: 0.65,
        },
        {
          id: 'experience-1',
          question: 'Describe your organization\'s experience with similar projects.',
          questionType: 'experience',
          expectedRelevantTopics: ['experience', 'past projects', 'track record', 'success'],
          minimumSimilarity: 0.65,
        },
        {
          id: 'goals-1',
          question: 'What are the primary goals and objectives of this project?',
          questionType: 'goals',
          expectedRelevantTopics: ['goals', 'objectives', 'outcomes', 'targets'],
          minimumSimilarity: 0.65,
        },
        {
          id: 'evaluation-1',
          question: 'How will you measure the success and impact of this project?',
          questionType: 'evaluation',
          expectedRelevantTopics: ['evaluation', 'metrics', 'measurement', 'impact'],
          minimumSimilarity: 0.65,
        },
        {
          id: 'sustainability-1',
          question: 'How will this project be sustained after the grant period ends?',
          questionType: 'sustainability',
          expectedRelevantTopics: ['sustainability', 'future funding', 'long-term'],
          minimumSimilarity: 0.6,
        },
        {
          id: 'budget-1',
          question: 'What is the total budget requested and how will funds be allocated?',
          questionType: 'budget',
          expectedRelevantTopics: ['budget', 'funding', 'costs', 'allocation'],
          minimumSimilarity: 0.65,
        },
        {
          id: 'beneficiaries-1',
          question: 'Who is your target population and how many people will be served?',
          expectedRelevantTopics: ['beneficiaries', 'target population', 'participants'],
          minimumSimilarity: 0.6,
        },
      ],
    };
  }
}