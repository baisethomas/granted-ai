import EmbeddingService from './embeddings';

export interface RetrievalQuery {
  text: string;
  questionTypes?: string[];
  organizationId?: number;
  maxResults?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
}

export interface RetrievalResult {
  chunkId: number;
  documentId: number;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
  documentTitle?: string;
  pageNumber?: number;
  sectionTitle?: string;
}

export interface RetrievalContext {
  query: string;
  results: RetrievalResult[];
  totalResults: number;
  averageSimilarity: number;
  processingTimeMs: number;
  sources: Array<{
    documentId: number;
    documentTitle: string;
    chunkCount: number;
  }>;
}

export class RetrievalService {
  private static readonly DEFAULT_MAX_RESULTS = 10;
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
  private static readonly DIVERSITY_THRESHOLD = 0.85; // Similarity threshold for diversity filtering

  /**
   * Retrieve relevant document chunks for a query
   */
  static async retrieveContext(query: RetrievalQuery): Promise<RetrievalContext> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query.text);

      // Perform vector search
      const searchResults = await this.vectorSearch({
        embedding: queryEmbedding.embedding,
        organizationId: query.organizationId,
        maxResults: (query.maxResults || this.DEFAULT_MAX_RESULTS) * 2, // Get more for filtering
        similarityThreshold: query.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD
      });

      // Apply post-processing filters
      let filteredResults = searchResults;
      
      // Filter by question types if specified
      if (query.questionTypes && query.questionTypes.length > 0) {
        filteredResults = this.filterByQuestionTypes(filteredResults, query.questionTypes);
      }

      // Apply diversity filtering
      filteredResults = this.applyDiversityFiltering(filteredResults);

      // Limit final results
      filteredResults = filteredResults.slice(0, query.maxResults || this.DEFAULT_MAX_RESULTS);

      // Calculate context metrics
      const averageSimilarity = filteredResults.length > 0 
        ? filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length 
        : 0;

      const sources = this.aggregateSources(filteredResults);
      const processingTimeMs = Date.now() - startTime;

      // Store retrieval session for analytics
      await this.logRetrievalSession({
        query: query.text,
        organizationId: query.organizationId,
        resultsCount: filteredResults.length,
        averageSimilarity,
        processingTimeMs
      });

      return {
        query: query.text,
        results: filteredResults,
        totalResults: filteredResults.length,
        averageSimilarity,
        processingTimeMs,
        sources
      };

    } catch (error) {
      console.error('Error in retrieval:', error);
      throw new Error(`Retrieval failed: ${error.message}`);
    }
  }

  /**
   * Perform vector similarity search
   */
  private static async vectorSearch(params: {
    embedding: number[];
    organizationId?: number;
    maxResults: number;
    similarityThreshold: number;
  }): Promise<RetrievalResult[]> {
    try {
      // In a real implementation, this would query the database
      // For now, returning mock data that follows the expected structure
      const mockResults: RetrievalResult[] = [
        {
          chunkId: 1,
          documentId: 1,
          content: "Our organization has been serving the community for over 15 years, focusing on educational programs that reach underserved populations. We have directly impacted over 5,000 students through our literacy and STEM programs.",
          similarity: 0.89,
          metadata: {
            chunkType: 'paragraph',
            hasNumbers: true,
            hasFinancialData: false,
            sectionTitle: 'Organization Background',
            pageNumber: 1
          },
          documentTitle: 'Organization Profile 2024',
          sectionTitle: 'Organization Background'
        },
        {
          chunkId: 2,
          documentId: 1,
          content: "Our annual budget of $2.5 million supports programs across three key areas: direct education services (60%), community outreach (25%), and administrative costs (15%). We maintain a 4.2 out of 5 rating from program participants.",
          similarity: 0.84,
          metadata: {
            chunkType: 'paragraph',
            hasNumbers: true,
            hasFinancialData: true,
            sectionTitle: 'Financial Overview',
            pageNumber: 2
          },
          documentTitle: 'Annual Report 2023',
          sectionTitle: 'Financial Overview'
        },
        {
          chunkId: 3,
          documentId: 2,
          content: "The evaluation methodology includes pre/post assessments, participant surveys, and longitudinal tracking. We measure success through standardized test improvements, program completion rates, and participant satisfaction scores.",
          similarity: 0.78,
          metadata: {
            chunkType: 'paragraph',
            hasNumbers: false,
            hasFinancialData: false,
            sectionTitle: 'Evaluation Methods',
            pageNumber: 1
          },
          documentTitle: 'Evaluation Framework',
          sectionTitle: 'Evaluation Methods'
        }
      ];

      return mockResults.filter(result => result.similarity >= params.similarityThreshold);

    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }

  /**
   * Filter results by question types
   */
  private static filterByQuestionTypes(
    results: RetrievalResult[], 
    questionTypes: string[]
  ): RetrievalResult[] {
    return results.filter(result => {
      const content = result.content.toLowerCase();
      
      // Define keywords for different question types
      const typeKeywords: Record<string, string[]> = {
        mission: ['mission', 'vision', 'purpose', 'goal', 'objective', 'serve', 'community'],
        methodology: ['method', 'approach', 'process', 'evaluation', 'measure', 'assess'],
        budget: ['budget', 'cost', 'funding', 'financial', 'expense', '$', 'dollar'],
        timeline: ['timeline', 'schedule', 'deadline', 'duration', 'month', 'year', 'phase'],
        outcomes: ['outcome', 'result', 'impact', 'effect', 'success', 'achievement', 'improve'],
        team: ['team', 'staff', 'personnel', 'experience', 'qualifications', 'director'],
        sustainability: ['sustainability', 'continuation', 'long-term', 'future', 'ongoing']
      };

      // Check if content matches any of the specified question types
      return questionTypes.some(type => {
        const keywords = typeKeywords[type.toLowerCase()] || [];
        return keywords.some(keyword => content.includes(keyword));
      });
    });
  }

  /**
   * Apply diversity filtering to avoid redundant results
   */
  private static applyDiversityFiltering(results: RetrievalResult[]): RetrievalResult[] {
    if (results.length <= 1) return results;

    const diverseResults: RetrievalResult[] = [results[0]]; // Always include the top result
    
    for (let i = 1; i < results.length; i++) {
      const candidate = results[i];
      
      // Check if this result is too similar to any already selected result
      const isTooSimilar = diverseResults.some(selected => {
        const similarity = this.calculateContentSimilarity(candidate.content, selected.content);
        return similarity > this.DIVERSITY_THRESHOLD;
      });

      if (!isTooSimilar) {
        diverseResults.push(candidate);
      }
    }

    return diverseResults;
  }

  /**
   * Calculate content similarity for diversity filtering (simple implementation)
   */
  private static calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Aggregate source information from results
   */
  private static aggregateSources(results: RetrievalResult[]): Array<{
    documentId: number;
    documentTitle: string;
    chunkCount: number;
  }> {
    const sourceMap = new Map<number, { title: string; count: number }>();

    results.forEach(result => {
      if (sourceMap.has(result.documentId)) {
        sourceMap.get(result.documentId)!.count++;
      } else {
        sourceMap.set(result.documentId, {
          title: result.documentTitle || `Document ${result.documentId}`,
          count: 1
        });
      }
    });

    return Array.from(sourceMap.entries()).map(([documentId, info]) => ({
      documentId,
      documentTitle: info.title,
      chunkCount: info.count
    }));
  }

  /**
   * Log retrieval session for analytics
   */
  private static async logRetrievalSession(session: {
    query: string;
    organizationId?: number;
    resultsCount: number;
    averageSimilarity: number;
    processingTimeMs: number;
  }): Promise<void> {
    try {
      // In a real implementation, this would save to the database
      console.log('Retrieval session logged:', {
        query: session.query,
        organizationId: session.organizationId,
        resultsCount: session.resultsCount,
        averageSimilarity: session.averageSimilarity,
        processingTimeMs: session.processingTimeMs
      });
    } catch (error) {
      console.error('Error logging retrieval session:', error);
      // Don't throw - logging failure shouldn't stop the process
    }
  }

  /**
   * Build context string from retrieval results
   */
  static buildContextString(retrievalContext: RetrievalContext, maxLength: number = 4000): string {
    let context = `Based on the following information from your organizational documents:\n\n`;
    
    let currentLength = context.length;
    
    for (const result of retrievalContext.results) {
      const sourceInfo = `[Source: ${result.documentTitle}${result.sectionTitle ? `, ${result.sectionTitle}` : ''}]\n`;
      const content = `${result.content}\n\n`;
      
      if (currentLength + sourceInfo.length + content.length > maxLength) {
        break;
      }
      
      context += sourceInfo + content;
      currentLength += sourceInfo.length + content.length;
    }

    // Add source summary
    if (retrievalContext.sources.length > 0) {
      context += `\nInformation sourced from ${retrievalContext.sources.length} document(s): `;
      context += retrievalContext.sources.map(s => s.documentTitle).join(', ');
    }

    return context;
  }

  /**
   * Validate retrieval quality
   */
  static validateRetrievalQuality(context: RetrievalContext): {
    isHighQuality: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check average similarity
    if (context.averageSimilarity < 0.7) {
      issues.push('Low average similarity score');
      recommendations.push('Consider refining your query or adding more specific documents');
    }

    // Check result count
    if (context.totalResults < 3) {
      issues.push('Low number of relevant results found');
      recommendations.push('Upload more relevant organizational documents');
    }

    // Check processing time
    if (context.processingTimeMs > 5000) {
      issues.push('Slow retrieval performance');
      recommendations.push('Consider optimizing your document collection');
    }

    // Check source diversity
    if (context.sources.length < 2 && context.totalResults > 5) {
      issues.push('Results from limited sources');
      recommendations.push('Ensure documents cover diverse aspects of your organization');
    }

    return {
      isHighQuality: issues.length === 0,
      issues,
      recommendations
    };
  }
}

export default RetrievalService;