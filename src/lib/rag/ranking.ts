import { ChunkWithSimilarity } from './retrieval';

export interface RankingOptions {
  weights?: {
    similarity?: number;
    recency?: number;
    relevance?: number;
    diversity?: number;
    authority?: number;
  };
  boosts?: {
    documentTypes?: Record<string, number>;
    sections?: Record<string, number>;
    keywords?: string[];
  };
  penalties?: {
    duplicateContent?: number;
    lowQuality?: number;
  };
}

export interface RankingContext {
  query: string;
  questionType?: string;
  organizationDomain?: string;
  userPreferences?: {
    emphasizeRecent?: boolean;
    preferSpecific?: boolean;
    diversityLevel?: number; // 0-1
  };
}

export interface RankedChunk extends ChunkWithSimilarity {
  rankingScore: number;
  rankingFactors: {
    similarity: number;
    recency: number;
    relevance: number;
    diversity: number;
    authority: number;
    adjustments: Record<string, number>;
  };
}

export class ContextRankingService {
  private defaultWeights = {
    similarity: 0.4,
    recency: 0.1,
    relevance: 0.3,
    diversity: 0.1,
    authority: 0.1,
  };

  /**
   * Rank and filter chunks based on multiple criteria
   */
  public rankChunks(
    chunks: ChunkWithSimilarity[],
    context: RankingContext,
    options: RankingOptions = {}
  ): RankedChunk[] {
    if (chunks.length === 0) return [];

    const weights = { ...this.defaultWeights, ...options.weights };
    const rankedChunks: RankedChunk[] = [];

    // Step 1: Calculate individual ranking factors
    for (const chunk of chunks) {
      const factors = this.calculateRankingFactors(chunk, context, chunks, options);
      
      // Step 2: Calculate weighted ranking score
      const rankingScore = 
        factors.similarity * weights.similarity +
        factors.recency * weights.recency +
        factors.relevance * weights.relevance +
        factors.diversity * weights.diversity +
        factors.authority * weights.authority +
        Object.values(factors.adjustments).reduce((sum, adj) => sum + adj, 0);

      rankedChunks.push({
        ...chunk,
        rankingScore: Math.max(0, Math.min(1, rankingScore)), // Clamp to 0-1
        rankingFactors: factors,
      });
    }

    // Step 3: Sort by ranking score
    rankedChunks.sort((a, b) => b.rankingScore - a.rankingScore);

    // Step 4: Apply diversity filtering if requested
    if (context.userPreferences?.diversityLevel && context.userPreferences.diversityLevel > 0.3) {
      return this.applyDiversityFiltering(rankedChunks, context.userPreferences.diversityLevel);
    }

    return rankedChunks;
  }

  /**
   * Calculate individual ranking factors for a chunk
   */
  private calculateRankingFactors(
    chunk: ChunkWithSimilarity,
    context: RankingContext,
    allChunks: ChunkWithSimilarity[],
    options: RankingOptions
  ): RankedChunk['rankingFactors'] {
    const factors = {
      similarity: chunk.similarity, // Already calculated
      recency: this.calculateRecencyScore(chunk),
      relevance: this.calculateRelevanceScore(chunk, context),
      diversity: this.calculateDiversityScore(chunk, allChunks),
      authority: this.calculateAuthorityScore(chunk),
      adjustments: this.calculateAdjustments(chunk, context, options),
    };

    return factors;
  }

  /**
   * Calculate recency score based on document age and section position
   */
  private calculateRecencyScore(chunk: ChunkWithSimilarity): number {
    // This is a simplified implementation
    // In a real system, you'd have document creation dates
    
    // Boost chunks that appear earlier in documents (often more important)
    const positionBoost = chunk.chunkIndex === 0 ? 0.2 : 
                         chunk.chunkIndex < 3 ? 0.1 : 0;
    
    return 0.5 + positionBoost; // Base score + position boost
  }

  /**
   * Calculate relevance score based on content analysis
   */
  private calculateRelevanceScore(chunk: ChunkWithSimilarity, context: RankingContext): number {
    let relevanceScore = 0;

    const content = chunk.content.toLowerCase();
    const query = context.query.toLowerCase();
    const sectionTitle = (chunk.sectionTitle || '').toLowerCase();

    // Exact phrase matches in content
    if (content.includes(query)) {
      relevanceScore += 0.3;
    }

    // Exact phrase matches in section title
    if (sectionTitle.includes(query)) {
      relevanceScore += 0.4;
    }

    // Question type specific boosts
    if (context.questionType) {
      const typeBoost = this.getQuestionTypeBoost(chunk, context.questionType);
      relevanceScore += typeBoost;
    }

    // Length penalty for very short chunks (often less informative)
    if (chunk.content.length < 100) {
      relevanceScore -= 0.1;
    }

    // Length penalty for very long chunks (often less focused)
    if (chunk.content.length > 2000) {
      relevanceScore -= 0.05;
    }

    return Math.max(0, Math.min(1, relevanceScore));
  }

  /**
   * Calculate diversity score to avoid too many similar chunks
   */
  private calculateDiversityScore(
    chunk: ChunkWithSimilarity,
    allChunks: ChunkWithSimilarity[]
  ): number {
    let diversityScore = 1.0;

    // Penalty for chunks from the same document
    const sameDocChunks = allChunks.filter(c => 
      c.documentId === chunk.documentId && c.id !== chunk.id
    );
    diversityScore -= sameDocChunks.length * 0.1;

    // Penalty for chunks from the same section
    if (chunk.sectionTitle) {
      const sameSectionChunks = allChunks.filter(c => 
        c.sectionTitle === chunk.sectionTitle && c.id !== chunk.id
      );
      diversityScore -= sameSectionChunks.length * 0.05;
    }

    return Math.max(0, diversityScore);
  }

  /**
   * Calculate authority score based on document type and section importance
   */
  private calculateAuthorityScore(chunk: ChunkWithSimilarity): number {
    let authorityScore = 0.5; // Base score

    const docType = chunk.metadata?.documentType;
    const sectionTitle = (chunk.sectionTitle || '').toLowerCase();

    // Document type authority
    const docTypeScores: Record<string, number> = {
      'organization-profile': 0.9,
      'program': 0.8,
      'assessment': 0.8,
      'evaluation': 0.7,
      'budget': 0.6,
      'general': 0.4,
    };
    
    if (docType && docTypeScores[docType]) {
      authorityScore = docTypeScores[docType];
    }

    // Section importance boosts
    const importantSections = [
      'mission', 'vision', 'overview', 'summary', 'executive summary',
      'objectives', 'goals', 'outcomes', 'impact', 'results',
      'experience', 'qualifications', 'capacity', 'track record'
    ];

    const isImportantSection = importantSections.some(section => 
      sectionTitle.includes(section)
    );

    if (isImportantSection) {
      authorityScore += 0.1;
    }

    return Math.min(1, authorityScore);
  }

  /**
   * Calculate adjustments based on boosts and penalties
   */
  private calculateAdjustments(
    chunk: ChunkWithSimilarity,
    context: RankingContext,
    options: RankingOptions
  ): Record<string, number> {
    const adjustments: Record<string, number> = {};

    // Document type boosts
    if (options.boosts?.documentTypes) {
      const docType = chunk.metadata?.documentType;
      if (docType && options.boosts.documentTypes[docType]) {
        adjustments.documentTypeBoost = (options.boosts.documentTypes[docType] - 1) * 0.1;
      }
    }

    // Section boosts
    if (options.boosts?.sections && chunk.sectionTitle) {
      const sectionLower = chunk.sectionTitle.toLowerCase();
      for (const [section, boost] of Object.entries(options.boosts.sections)) {
        if (sectionLower.includes(section.toLowerCase())) {
          adjustments.sectionBoost = (boost - 1) * 0.1;
          break;
        }
      }
    }

    // Keyword boosts
    if (options.boosts?.keywords) {
      const content = chunk.content.toLowerCase();
      let keywordMatches = 0;
      
      for (const keyword of options.boosts.keywords) {
        const matches = (content.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        keywordMatches += matches;
      }
      
      if (keywordMatches > 0) {
        adjustments.keywordBoost = Math.min(0.2, keywordMatches * 0.02);
      }
    }

    // Quality penalties
    if (options.penalties?.lowQuality) {
      const qualityScore = this.assessContentQuality(chunk);
      if (qualityScore < 0.5) {
        adjustments.qualityPenalty = -options.penalties.lowQuality * (0.5 - qualityScore);
      }
    }

    return adjustments;
  }

  /**
   * Get question type specific boosts
   */
  private getQuestionTypeBoost(chunk: ChunkWithSimilarity, questionType: string): number {
    const content = chunk.content.toLowerCase();
    const sectionTitle = (chunk.sectionTitle || '').toLowerCase();

    const typeKeywords: Record<string, string[]> = {
      mission: ['mission', 'vision', 'purpose', 'values', 'goals'],
      needs: ['problem', 'need', 'challenge', 'issue', 'gap', 'data', 'statistics'],
      goals: ['goal', 'objective', 'outcome', 'target', 'aim', 'result'],
      methods: ['method', 'approach', 'strategy', 'process', 'implementation', 'plan'],
      evaluation: ['evaluation', 'measure', 'metric', 'assess', 'monitor', 'track'],
      budget: ['budget', 'cost', 'expense', 'financial', 'funding', 'price'],
      experience: ['experience', 'history', 'past', 'previous', 'track record', 'success'],
      sustainability: ['sustain', 'continue', 'future', 'long-term', 'maintain'],
    };

    const keywords = typeKeywords[questionType] || [];
    let boost = 0;

    for (const keyword of keywords) {
      if (sectionTitle.includes(keyword)) {
        boost += 0.2;
      } else if (content.includes(keyword)) {
        boost += 0.1;
      }
    }

    return Math.min(0.4, boost);
  }

  /**
   * Assess content quality based on various heuristics
   */
  private assessContentQuality(chunk: ChunkWithSimilarity): number {
    const content = chunk.content;
    let qualityScore = 0.5;

    // Sentence structure (presence of proper sentences)
    const sentenceCount = (content.match(/[.!?]+/g) || []).length;
    const wordCount = content.split(/\s+/).length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 30) {
      qualityScore += 0.2;
    }

    // Presence of numbers/data (often valuable in grant context)
    if (/\d+/.test(content)) {
      qualityScore += 0.1;
    }

    // Presence of percentages, dollar amounts, or metrics
    if (/(\d+%|\$\d+|\d+\s*(people|participants|beneficiaries|years|months))/i.test(content)) {
      qualityScore += 0.2;
    }

    // Penalty for very repetitive content
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueness = uniqueWords.size / words.length;
    
    if (uniqueness < 0.3) {
      qualityScore -= 0.2;
    }

    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Apply diversity filtering to avoid too many similar chunks
   */
  private applyDiversityFiltering(rankedChunks: RankedChunk[], diversityLevel: number): RankedChunk[] {
    const filtered: RankedChunk[] = [];
    const usedDocuments = new Set<string>();
    const usedSections = new Set<string>();

    for (const chunk of rankedChunks) {
      let shouldInclude = true;

      // Document diversity check
      if (usedDocuments.has(chunk.documentId)) {
        if (Math.random() > (1 - diversityLevel * 0.7)) {
          shouldInclude = false;
        }
      }

      // Section diversity check
      const sectionKey = `${chunk.documentId}-${chunk.sectionTitle || 'general'}`;
      if (usedSections.has(sectionKey)) {
        if (Math.random() > (1 - diversityLevel)) {
          shouldInclude = false;
        }
      }

      if (shouldInclude) {
        filtered.push(chunk);
        usedDocuments.add(chunk.documentId);
        usedSections.add(sectionKey);
      }

      // Stop if we have enough diverse chunks
      if (filtered.length >= 8) {
        break;
      }
    }

    return filtered;
  }

  /**
   * Filter chunks by minimum quality threshold
   */
  public filterByQuality(chunks: RankedChunk[], minQualityScore: number = 0.3): RankedChunk[] {
    return chunks.filter(chunk => {
      const qualityScore = this.assessContentQuality(chunk);
      return qualityScore >= minQualityScore;
    });
  }

  /**
   * Re-rank chunks based on user feedback (for learning)
   */
  public adjustRankingBasedOnFeedback(
    chunks: RankedChunk[],
    feedback: Array<{ chunkId: string; helpful: boolean; relevance: number }>
  ): RankedChunk[] {
    const feedbackMap = new Map(
      feedback.map(f => [f.chunkId, f])
    );

    return chunks.map(chunk => {
      const chunkFeedback = feedbackMap.get(chunk.id);
      
      if (chunkFeedback) {
        // Adjust ranking score based on feedback
        let adjustment = 0;
        
        if (chunkFeedback.helpful) {
          adjustment += 0.1;
        } else {
          adjustment -= 0.1;
        }
        
        // Normalize relevance feedback (assume 1-5 scale)
        const normalizedRelevance = chunkFeedback.relevance / 5;
        adjustment += (normalizedRelevance - 0.5) * 0.2;
        
        return {
          ...chunk,
          rankingScore: Math.max(0, Math.min(1, chunk.rankingScore + adjustment)),
        };
      }
      
      return chunk;
    }).sort((a, b) => b.rankingScore - a.rankingScore);
  }
}