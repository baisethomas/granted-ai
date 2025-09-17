import OpenAI from 'openai';
import crypto from 'crypto';
import { supabaseBrowserClient } from '../supabase/client';
import { embeddingCache, docChunks } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  cached: boolean;
}

export interface BatchEmbeddingRequest {
  id: string;
  content: string;
  contentHash?: string;
}

export interface BatchEmbeddingResult {
  id: string;
  embedding: number[];
  tokens: number;
  cached: boolean;
  error?: string;
}

export class EmbeddingService {
  private openai: OpenAI;
  private model = 'text-embedding-3-small';
  private dimensions = 1536;
  private maxBatchSize = 100; // OpenAI's batch limit
  private maxTokensPerRequest = 8191; // Model's token limit

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!key || key === 'default_key') {
      throw new Error('OpenAI API key is required for embedding generation');
    }
    
    this.openai = new OpenAI({ apiKey: key });
  }

  /**
   * Generate content hash for caching
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Estimate token count (simple heuristic: 4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Clean and prepare text for embedding
   */
  private preprocessText(text: string): string {
    return text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 8191 * 4); // Rough token limit enforcement
  }

  /**
   * Get embedding from cache if available
   */
  private async getCachedEmbedding(contentHash: string): Promise<number[] | null> {
    try {
      if (!supabaseBrowserClient) {
        console.warn('Supabase client not available for embedding cache');
        return null;
      }

      // Note: In a real implementation, you'd use the drizzle client here
      // For now, we'll use Supabase client directly
      const { data, error } = await supabaseBrowserClient
        .from('embedding_cache')
        .select('embedding')
        .eq('content_hash', contentHash)
        .eq('model', this.model)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Cache lookup error:', error);
        }
        return null;
      }

      return data?.embedding || null;
    } catch (error) {
      console.error('Error accessing embedding cache:', error);
      return null;
    }
  }

  /**
   * Cache embedding for future use
   */
  private async cacheEmbedding(contentHash: string, content: string, embedding: number[]): Promise<void> {
    try {
      if (!supabaseBrowserClient) {
        console.warn('Supabase client not available for embedding cache');
        return;
      }

      const { error } = await supabaseBrowserClient
        .from('embedding_cache')
        .upsert({
          content_hash: contentHash,
          content: content.substring(0, 1000), // Store truncated content for reference
          embedding,
          model: this.model,
        });

      if (error) {
        console.error('Error caching embedding:', error);
      }
    } catch (error) {
      console.error('Error caching embedding:', error);
    }
  }

  /**
   * Generate embedding for a single piece of content
   */
  public async generateEmbedding(content: string): Promise<EmbeddingResult> {
    const cleanContent = this.preprocessText(content);
    if (!cleanContent) {
      throw new Error('Content is empty after preprocessing');
    }

    const contentHash = this.generateContentHash(cleanContent);
    const estimatedTokens = this.estimateTokens(cleanContent);

    // Check if we have a cached embedding
    const cachedEmbedding = await this.getCachedEmbedding(contentHash);
    if (cachedEmbedding) {
      return {
        embedding: cachedEmbedding,
        tokens: estimatedTokens,
        cached: true,
      };
    }

    // Ensure content doesn't exceed token limit
    if (estimatedTokens > this.maxTokensPerRequest) {
      throw new Error(`Content too long: ${estimatedTokens} tokens (max: ${this.maxTokensPerRequest})`);
    }

    try {
      console.log(`Generating embedding for content (${estimatedTokens} tokens)...`);
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: cleanContent,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0].embedding;
      const actualTokens = response.usage.total_tokens;

      // Cache the embedding
      await this.cacheEmbedding(contentHash, cleanContent, embedding);

      return {
        embedding,
        tokens: actualTokens,
        cached: false,
      };
    } catch (error: any) {
      console.error('Error generating embedding:', error);
      
      if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }
      
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple pieces of content in batches
   */
  public async generateBatchEmbeddings(requests: BatchEmbeddingRequest[]): Promise<BatchEmbeddingResult[]> {
    const results: BatchEmbeddingResult[] = [];
    
    // Process in batches to respect API limits
    for (let i = 0; i < requests.length; i += this.maxBatchSize) {
      const batch = requests.slice(i, i + this.maxBatchSize);
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + this.maxBatchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Process a batch of embedding requests
   */
  private async processBatch(requests: BatchEmbeddingRequest[]): Promise<BatchEmbeddingResult[]> {
    const results: BatchEmbeddingResult[] = [];
    
    // Prepare requests, checking cache first
    const pendingRequests: Array<{ 
      index: number; 
      content: string; 
      contentHash: string; 
      id: string;
      tokens: number;
    }> = [];
    
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const cleanContent = this.preprocessText(request.content);
      const contentHash = request.contentHash || this.generateContentHash(cleanContent);
      const estimatedTokens = this.estimateTokens(cleanContent);
      
      if (!cleanContent) {
        results.push({
          id: request.id,
          embedding: [],
          tokens: 0,
          cached: false,
          error: 'Content is empty after preprocessing',
        });
        continue;
      }

      if (estimatedTokens > this.maxTokensPerRequest) {
        results.push({
          id: request.id,
          embedding: [],
          tokens: estimatedTokens,
          cached: false,
          error: `Content too long: ${estimatedTokens} tokens`,
        });
        continue;
      }

      // Check cache
      const cachedEmbedding = await this.getCachedEmbedding(contentHash);
      if (cachedEmbedding) {
        results.push({
          id: request.id,
          embedding: cachedEmbedding,
          tokens: estimatedTokens,
          cached: true,
        });
      } else {
        pendingRequests.push({
          index: results.length,
          content: cleanContent,
          contentHash,
          id: request.id,
          tokens: estimatedTokens,
        });
        // Placeholder for now
        results.push({
          id: request.id,
          embedding: [],
          tokens: estimatedTokens,
          cached: false,
        });
      }
    }

    // If no pending requests, return cached results
    if (pendingRequests.length === 0) {
      return results;
    }

    try {
      console.log(`Generating ${pendingRequests.length} embeddings...`);
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: pendingRequests.map(req => req.content),
        dimensions: this.dimensions,
      });

      // Update results with generated embeddings
      for (let i = 0; i < response.data.length; i++) {
        const embedding = response.data[i].embedding;
        const request = pendingRequests[i];
        const resultIndex = request.index;
        
        results[resultIndex] = {
          id: request.id,
          embedding,
          tokens: Math.floor(response.usage.total_tokens / pendingRequests.length), // Approximate
          cached: false,
        };

        // Cache the embedding
        await this.cacheEmbedding(request.contentHash, request.content, embedding);
      }

      return results;
    } catch (error: any) {
      console.error('Error in batch embedding generation:', error);
      
      // Mark all pending requests as failed
      for (const request of pendingRequests) {
        results[request.index] = {
          id: request.id,
          embedding: [],
          tokens: request.tokens,
          cached: false,
          error: error.message || 'Failed to generate embedding',
        };
      }
      
      return results;
    }
  }

  /**
   * Calculate similarity between two embeddings using cosine similarity
   */
  public calculateSimilarity(embedding1: number[], embedding2: number[]): number {
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

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Validate that an embedding has the correct dimensions
   */
  public isValidEmbedding(embedding: any): embedding is number[] {
    return (
      Array.isArray(embedding) &&
      embedding.length === this.dimensions &&
      embedding.every((val: any) => typeof val === 'number' && !isNaN(val))
    );
  }

  /**
   * Get embedding statistics
   */
  public getModelInfo(): {
    model: string;
    dimensions: number;
    maxTokens: number;
  } {
    return {
      model: this.model,
      dimensions: this.dimensions,
      maxTokens: this.maxTokensPerRequest,
    };
  }
}