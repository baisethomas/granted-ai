import OpenAI from 'openai';
import { createHash } from 'crypto';
import { getAuthHeaders } from '../queryClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
  cached: boolean;
}

export interface EmbeddingBatchItem {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingBatchResult {
  id: string;
  embedding: number[];
  tokenCount: number;
  cached: boolean;
  error?: string;
}

export class EmbeddingService {
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private static readonly EMBEDDING_DIMENSIONS = 1536;
  private static readonly MAX_BATCH_SIZE = 100;

  /**
   * Generate embedding for a single text content
   */
  static async generateEmbedding(content: string): Promise<EmbeddingResult> {
    try {
      const contentHash = this.generateContentHash(content);
      
      // Check cache first
      const cachedEmbedding = await this.getCachedEmbedding(contentHash);
      if (cachedEmbedding) {
        await this.updateCacheUsage(contentHash);
        return {
          embedding: cachedEmbedding.embedding,
          tokenCount: cachedEmbedding.token_count,
          cached: true
        };
      }

      // Generate new embedding
      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: content,
        dimensions: this.EMBEDDING_DIMENSIONS,
      });

      const embedding = response.data[0].embedding;
      const tokenCount = response.usage.total_tokens;

      // Cache the result
      await this.cacheEmbedding(contentHash, content, embedding, tokenCount);

      return {
        embedding,
        tokenCount,
        cached: false
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  static async generateEmbeddingBatch(items: EmbeddingBatchItem[]): Promise<EmbeddingBatchResult[]> {
    if (items.length === 0) return [];
    
    const results: EmbeddingBatchResult[] = [];
    
    // Process in batches
    for (let i = 0; i < items.length; i += this.MAX_BATCH_SIZE) {
      const batch = items.slice(i, i + this.MAX_BATCH_SIZE);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single batch of embedding requests
   */
  private static async processBatch(batch: EmbeddingBatchItem[]): Promise<EmbeddingBatchResult[]> {
    const results: EmbeddingBatchResult[] = [];
    
    // Check cache for all items first
    const cacheChecks = await Promise.all(
      batch.map(async (item) => {
        const hash = this.generateContentHash(item.content);
        const cached = await this.getCachedEmbedding(hash);
        return { item, hash, cached };
      })
    );

    // Separate cached and non-cached items
    const cachedResults: EmbeddingBatchResult[] = [];
    const uncachedItems: { item: EmbeddingBatchItem; hash: string }[] = [];

    for (const check of cacheChecks) {
      if (check.cached) {
        cachedResults.push({
          id: check.item.id,
          embedding: check.cached.embedding,
          tokenCount: check.cached.token_count,
          cached: true
        });
        await this.updateCacheUsage(check.hash);
      } else {
        uncachedItems.push({ item: check.item, hash: check.hash });
      }
    }

    results.push(...cachedResults);

    // Generate embeddings for non-cached items
    if (uncachedItems.length > 0) {
      try {
        const response = await openai.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: uncachedItems.map(item => item.item.content),
          dimensions: this.EMBEDDING_DIMENSIONS,
        });

        // Process results and cache them
        for (let i = 0; i < uncachedItems.length; i++) {
          const item = uncachedItems[i];
          const embeddingData = response.data[i];
          const tokenCount = Math.round(response.usage.total_tokens / uncachedItems.length);

          results.push({
            id: item.item.id,
            embedding: embeddingData.embedding,
            tokenCount,
            cached: false
          });

          // Cache the result
          await this.cacheEmbedding(
            item.hash,
            item.item.content,
            embeddingData.embedding,
            tokenCount
          );
        }
      } catch (error) {
        console.error('Error in batch embedding generation:', error);
        
        // Add error results for failed items
        for (const item of uncachedItems) {
          results.push({
            id: item.item.id,
            embedding: [],
            tokenCount: 0,
            cached: false,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate content hash for caching
   */
  private static generateContentHash(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Get cached embedding from database
   */
  private static async getCachedEmbedding(contentHash: string): Promise<any> {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/embeddings/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'get', hash: contentHash })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.embedding || null;
    } catch (error) {
      console.error('Error checking embedding cache:', error);
      return null;
    }
  }

  /**
   * Cache embedding in database
   */
  private static async cacheEmbedding(
    contentHash: string, 
    content: string, 
    embedding: number[], 
    tokenCount: number
  ): Promise<void> {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/embeddings/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'set',
          hash: contentHash,
          content: content.substring(0, 200) + '...', // Preview only
          embedding,
          tokenCount
        })
      });
    } catch (error) {
      console.error('Error caching embedding:', error);
      // Don't throw - caching failure shouldn't stop the process
    }
  }

  /**
   * Update cache usage statistics
   */
  private static async updateCacheUsage(contentHash: string): Promise<void> {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/embeddings/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'update_usage', hash: contentHash })
      });
    } catch (error) {
      console.error('Error updating cache usage:', error);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Estimate token count for content (rough approximation)
   */
  static estimateTokenCount(content: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Validate embedding dimensions
   */
  static isValidEmbedding(embedding: number[]): boolean {
    return Array.isArray(embedding) && 
           embedding.length === this.EMBEDDING_DIMENSIONS &&
           embedding.every(num => typeof num === 'number' && !isNaN(num));
  }
}

export default EmbeddingService;
