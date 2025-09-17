import { supabaseBrowserClient } from '../supabase/client';
import { EmbeddingService } from './embeddings';

export interface ChunkWithSimilarity {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  sectionTitle?: string;
  pageNumber?: number;
  metadata: any;
  similarity: number;
  embedding?: number[];
}

export interface RetrievalResult {
  chunks: ChunkWithSimilarity[];
  totalTokens: number;
  retrievalTimeMs: number;
  queryEmbedding: number[];
}

export interface RetrievalOptions {
  limit?: number;
  similarityThreshold?: number;
  organizationId?: string;
  documentIds?: string[];
  categories?: string[];
  sectionTitles?: string[];
  includeMetadata?: boolean;
  diversityFactor?: number; // 0-1, higher means more diverse results
  maxTokens?: number; // Limit total tokens in retrieved chunks
}

export interface HybridSearchOptions extends RetrievalOptions {
  keywordWeight?: number; // 0-1, weight for keyword vs semantic search
  keywords?: string[];
  boostFactors?: {
    recency?: number;
    sectionRelevance?: number;
    documentType?: Record<string, number>;
  };
}

export class VectorRetrievalService {
  private embeddingService: EmbeddingService;
  private defaultLimit = 10;
  private defaultSimilarityThreshold = 0.7;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService || new EmbeddingService();
  }

  /**
   * Perform semantic search using vector similarity
   */
  public async semanticSearch(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const opts = {
      limit: this.defaultLimit,
      similarityThreshold: this.defaultSimilarityThreshold,
      includeMetadata: true,
      diversityFactor: 0.3,
      maxTokens: 4000,
      ...options,
    };

    try {
      // Generate query embedding
      const { embedding: queryEmbedding } = await this.embeddingService.generateEmbedding(query);

      // Build the query
      let supabaseQuery = supabaseBrowserClient!
        .rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: opts.similarityThreshold,
          match_count: opts.limit * 2, // Get extra for filtering and diversity
        });

      // Apply filters if provided
      if (opts.organizationId) {
        supabaseQuery = supabaseQuery.eq('organization_id', opts.organizationId);
      }

      if (opts.documentIds && opts.documentIds.length > 0) {
        supabaseQuery = supabaseQuery.in('document_id', opts.documentIds);
      }

      const { data: rawChunks, error } = await supabaseQuery;

      if (error) {
        throw new Error(`Vector search failed: ${error.message}`);
      }

      if (!rawChunks || rawChunks.length === 0) {
        return {
          chunks: [],
          totalTokens: 0,
          retrievalTimeMs: Date.now() - startTime,
          queryEmbedding,
        };
      }

      // Transform and filter results
      let chunks: ChunkWithSimilarity[] = rawChunks.map((chunk: any) => ({
        id: chunk.id,
        documentId: chunk.document_id,
        content: chunk.content,
        chunkIndex: chunk.chunk_index,
        sectionTitle: chunk.section_title,
        pageNumber: chunk.page_number,
        metadata: chunk.metadata || {},
        similarity: chunk.similarity,
      }));

      // Apply additional filters
      chunks = this.applyFilters(chunks, opts);

      // Apply diversity if requested
      if (opts.diversityFactor > 0) {
        chunks = this.applyDiversity(chunks, opts.diversityFactor);
      }

      // Limit by token count if specified
      if (opts.maxTokens) {
        chunks = this.limitByTokens(chunks, opts.maxTokens);
      }

      // Final limit
      chunks = chunks.slice(0, opts.limit);

      const totalTokens = chunks.reduce((sum, chunk) => {
        return sum + this.estimateTokens(chunk.content);
      }, 0);

      return {
        chunks,
        totalTokens,
        retrievalTimeMs: Date.now() - startTime,
        queryEmbedding,
      };
    } catch (error: any) {
      console.error('Semantic search error:', error);
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Perform hybrid search combining semantic and keyword search
   */
  public async hybridSearch(
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<RetrievalResult> {
    const opts = {
      keywordWeight: 0.3,
      ...options,
    };

    // For now, perform semantic search with keyword boosting
    // In a full implementation, you'd combine with full-text search
    const semanticResults = await this.semanticSearch(query, opts);

    // Apply keyword boosting if keywords are provided
    if (opts.keywords && opts.keywords.length > 0) {
      semanticResults.chunks = this.applyKeywordBoosting(
        semanticResults.chunks,
        opts.keywords,
        opts.keywordWeight
      );
    }

    // Apply boost factors
    if (opts.boostFactors) {
      semanticResults.chunks = this.applyBoostFactors(
        semanticResults.chunks,
        opts.boostFactors
      );
    }

    // Re-sort by adjusted similarity scores
    semanticResults.chunks.sort((a, b) => b.similarity - a.similarity);

    return semanticResults;
  }

  /**
   * Find similar chunks to a given chunk (for related content discovery)
   */
  public async findSimilarChunks(
    chunkId: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    try {
      // Get the chunk and its embedding
      const { data: chunk, error: chunkError } = await supabaseBrowserClient!
        .from('doc_chunks')
        .select('embedding, content, document_id, organization_id')
        .eq('id', chunkId)
        .single();

      if (chunkError || !chunk) {
        throw new Error(`Chunk not found: ${chunkId}`);
      }

      // Use the chunk's embedding for similarity search
      const opts = {
        ...options,
        organizationId: options.organizationId || chunk.organization_id,
      };

      // Exclude the original chunk from results
      const { data: similarChunks, error } = await supabaseBrowserClient!
        .rpc('match_documents', {
          query_embedding: chunk.embedding,
          match_threshold: opts.similarityThreshold || this.defaultSimilarityThreshold,
          match_count: (opts.limit || this.defaultLimit) + 1,
        })
        .neq('id', chunkId);

      if (error) {
        throw new Error(`Similar chunks search failed: ${error.message}`);
      }

      const chunks: ChunkWithSimilarity[] = (similarChunks || []).slice(0, opts.limit || this.defaultLimit);

      return {
        chunks: chunks.map((c: any) => ({
          id: c.id,
          documentId: c.document_id,
          content: c.content,
          chunkIndex: c.chunk_index,
          sectionTitle: c.section_title,
          pageNumber: c.page_number,
          metadata: c.metadata || {},
          similarity: c.similarity,
        })),
        totalTokens: chunks.reduce((sum, chunk) => sum + this.estimateTokens(chunk.content), 0),
        retrievalTimeMs: Date.now() - startTime,
        queryEmbedding: chunk.embedding,
      };
    } catch (error: any) {
      console.error('Find similar chunks error:', error);
      throw new Error(`Find similar chunks failed: ${error.message}`);
    }
  }

  /**
   * Apply additional filters to search results
   */
  private applyFilters(chunks: ChunkWithSimilarity[], options: RetrievalOptions): ChunkWithSimilarity[] {
    let filtered = chunks;

    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter(chunk => {
        const docType = chunk.metadata?.documentType;
        return docType && options.categories!.includes(docType);
      });
    }

    if (options.sectionTitles && options.sectionTitles.length > 0) {
      filtered = filtered.filter(chunk => {
        return chunk.sectionTitle && 
               options.sectionTitles!.some(title => 
                 chunk.sectionTitle!.toLowerCase().includes(title.toLowerCase())
               );
      });
    }

    return filtered;
  }

  /**
   * Apply diversity to avoid too many similar chunks
   */
  private applyDiversity(chunks: ChunkWithSimilarity[], diversityFactor: number): ChunkWithSimilarity[] {
    if (diversityFactor === 0 || chunks.length <= 2) {
      return chunks;
    }

    const diverseChunks: ChunkWithSimilarity[] = [];
    const used = new Set<string>();

    for (const chunk of chunks) {
      if (diverseChunks.length === 0) {
        diverseChunks.push(chunk);
        used.add(chunk.documentId);
        continue;
      }

      // Check if this chunk is too similar to already selected chunks
      const isDiverse = this.isDiverseEnough(chunk, diverseChunks, diversityFactor);
      
      if (isDiverse) {
        diverseChunks.push(chunk);
        used.add(chunk.documentId);
      }
    }

    // Fill remaining slots with non-diverse chunks if we don't have enough
    const remainingLimit = Math.min(chunks.length, 10) - diverseChunks.length;
    for (const chunk of chunks) {
      if (diverseChunks.length >= 10) break;
      if (!diverseChunks.find(d => d.id === chunk.id)) {
        diverseChunks.push(chunk);
      }
    }

    return diverseChunks;
  }

  /**
   * Check if a chunk is diverse enough compared to already selected chunks
   */
  private isDiverseEnough(
    chunk: ChunkWithSimilarity,
    selectedChunks: ChunkWithSimilarity[],
    diversityFactor: number
  ): boolean {
    // Different document = more diverse
    if (!selectedChunks.find(s => s.documentId === chunk.documentId)) {
      return true;
    }

    // Different section = somewhat diverse
    if (chunk.sectionTitle && 
        !selectedChunks.find(s => s.sectionTitle === chunk.sectionTitle)) {
      return Math.random() < (1 - diversityFactor * 0.5);
    }

    // Same document, same section = less diverse
    return Math.random() < (1 - diversityFactor);
  }

  /**
   * Limit results by total token count
   */
  private limitByTokens(chunks: ChunkWithSimilarity[], maxTokens: number): ChunkWithSimilarity[] {
    const limited: ChunkWithSimilarity[] = [];
    let totalTokens = 0;

    for (const chunk of chunks) {
      const chunkTokens = this.estimateTokens(chunk.content);
      if (totalTokens + chunkTokens <= maxTokens) {
        limited.push(chunk);
        totalTokens += chunkTokens;
      } else {
        break;
      }
    }

    return limited;
  }

  /**
   * Apply keyword boosting to similarity scores
   */
  private applyKeywordBoosting(
    chunks: ChunkWithSimilarity[],
    keywords: string[],
    keywordWeight: number
  ): ChunkWithSimilarity[] {
    return chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      const sectionTitle = (chunk.sectionTitle || '').toLowerCase();
      
      let keywordScore = 0;
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        const contentMatches = (content.match(new RegExp(keywordLower, 'gi')) || []).length;
        const titleMatches = (sectionTitle.match(new RegExp(keywordLower, 'gi')) || []).length;
        keywordScore += contentMatches * 0.1 + titleMatches * 0.2;
      }

      // Normalize keyword score (0-1) and blend with similarity
      const normalizedKeywordScore = Math.min(keywordScore / 10, 1);
      const boostedSimilarity = 
        chunk.similarity * (1 - keywordWeight) + 
        normalizedKeywordScore * keywordWeight;

      return {
        ...chunk,
        similarity: boostedSimilarity,
      };
    });
  }

  /**
   * Apply various boost factors to similarity scores
   */
  private applyBoostFactors(
    chunks: ChunkWithSimilarity[],
    boostFactors: NonNullable<HybridSearchOptions['boostFactors']>
  ): ChunkWithSimilarity[] {
    return chunks.map(chunk => {
      let boostedSimilarity = chunk.similarity;

      // Document type boosting
      if (boostFactors.documentType && chunk.metadata?.documentType) {
        const typeBoost = boostFactors.documentType[chunk.metadata.documentType] || 1;
        boostedSimilarity *= typeBoost;
      }

      // Section relevance boosting
      if (boostFactors.sectionRelevance && chunk.sectionTitle) {
        // Simple heuristic: boost certain section types
        const importantSections = ['mission', 'objectives', 'goals', 'outcomes', 'impact'];
        const isImportantSection = importantSections.some(section => 
          chunk.sectionTitle!.toLowerCase().includes(section)
        );
        if (isImportantSection) {
          boostedSimilarity *= (boostFactors.sectionRelevance || 1.1);
        }
      }

      return {
        ...chunk,
        similarity: Math.min(boostedSimilarity, 1), // Cap at 1
      };
    });
  }

  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Build context string from retrieved chunks
   */
  public buildContext(chunks: ChunkWithSimilarity[]): string {
    return chunks
      .map((chunk, index) => {
        const header = chunk.sectionTitle 
          ? `[${chunk.sectionTitle}]` 
          : `[Document ${chunk.documentId.slice(0, 8)}...]`;
        
        return `${header}\n${chunk.content}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Get retrieval statistics
   */
  public async getRetrievalStats(organizationId: string): Promise<{
    totalChunks: number;
    totalDocuments: number;
    avgSimilarity: number;
  }> {
    try {
      const { data: stats, error } = await supabaseBrowserClient!
        .rpc('get_organization_chunk_stats', { org_id: organizationId });

      if (error) {
        throw error;
      }

      return {
        totalChunks: stats.total_chunks || 0,
        totalDocuments: stats.total_documents || 0,
        avgSimilarity: stats.avg_similarity || 0,
      };
    } catch (error) {
      console.error('Error getting retrieval stats:', error);
      return {
        totalChunks: 0,
        totalDocuments: 0,
        avgSimilarity: 0,
      };
    }
  }
}