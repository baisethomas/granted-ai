/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 * 
 * Complete RAG implementation for Granted AI platform including:
 * - Document chunking with semantic awareness
 * - Embedding generation with OpenAI text-embedding-3-small
 * - Vector storage and retrieval with Supabase pgvector
 * - Context ranking and filtering
 * - Batch processing and caching
 * - Quality testing framework
 */

// Core pipeline components
export { RAGPipeline, type DocumentProcessingResult, type ContextGenerationResult } from './pipeline';

// Document chunking
export { 
  DocumentChunker, 
  type DocumentChunk, 
  type ChunkingOptions 
} from './chunking';

// Embedding generation
export { 
  EmbeddingService, 
  type EmbeddingResult, 
  type BatchEmbeddingRequest, 
  type BatchEmbeddingResult 
} from './embeddings';

// Vector retrieval
export { 
  VectorRetrievalService, 
  type ChunkWithSimilarity, 
  type RetrievalResult, 
  type RetrievalOptions, 
  type HybridSearchOptions 
} from './retrieval';

// Context ranking and filtering
export { 
  ContextRankingService, 
  type RankingOptions, 
  type RankingContext, 
  type RankedChunk 
} from './ranking';

// Batch processing
export { 
  BatchProcessor, 
  type BatchJob, 
  type BatchJobItem, 
  type BatchProcessingOptions, 
  type BatchResult 
} from './batch-processor';

// Caching system
export { 
  CacheManager, 
  cacheManager, 
  type CacheEntry, 
  type CacheOptions, 
  type CacheStats 
} from './cache-manager';

// Quality testing framework
export { 
  QualityTestingFramework, 
  type TestQuery, 
  type RetrievalTestResult, 
  type TestSuite, 
  type QualityMetrics 
} from './quality-testing';

/**
 * Create a complete RAG pipeline with default configuration
 */
export function createRAGPipeline(options: {
  openaiApiKey?: string;
  enableCaching?: boolean;
} = {}) {
  const embeddingService = new EmbeddingService(options.openaiApiKey);
  const ragPipeline = new RAGPipeline(embeddingService);
  
  return {
    pipeline: ragPipeline,
    embeddingService,
    retrievalService: new VectorRetrievalService(embeddingService),
    batchProcessor: new BatchProcessor(embeddingService),
    qualityTester: new QualityTestingFramework(),
  };
}

/**
 * Utility function to process documents in batch
 */
export async function processDocumentsBatch(
  documents: Array<{
    id: string;
    content: string;
    filename: string;
  }>,
  organizationId: string,
  options?: {
    batchSize?: number;
    concurrency?: number;
  }
) {
  const { batchProcessor } = createRAGPipeline();
  
  return await batchProcessor.queueDocumentProcessing(
    documents,
    organizationId,
    options
  );
}

/**
 * Utility function to perform semantic search
 */
export async function semanticSearch(
  query: string,
  organizationId: string,
  options?: {
    limit?: number;
    similarityThreshold?: number;
    diversityFactor?: number;
    keywords?: string[];
  }
) {
  const { retrievalService } = createRAGPipeline();
  
  return await retrievalService.hybridSearch(query, {
    organizationId,
    ...options,
  });
}

/**
 * Utility function to generate optimized context for a question
 */
export async function generateOptimizedContext(
  question: string,
  organizationId: string,
  questionType?: 'mission' | 'needs' | 'goals' | 'methods' | 'evaluation' | 'budget' | 'experience' | 'sustainability'
) {
  const { pipeline } = createRAGPipeline();
  
  const retrievalOptions = questionType ? {
    limit: 6,
    similarityThreshold: 0.65,
    diversityFactor: 0.4,
    maxTokens: 3500,
    keywordWeight: 0.25,
  } : {};

  return await pipeline.generateContext(question, organizationId, retrievalOptions);
}

/**
 * Utility function to run quality tests
 */
export async function runQualityTest(organizationId: string) {
  const { qualityTester } = createRAGPipeline();
  
  const testSuite = qualityTester.createStandardTestSuite(organizationId);
  return await qualityTester.runTestSuite(testSuite);
}

// Re-export components from other modules for convenience
export { 
  buildRAGContext, 
  buildOptimizedContext 
} from '../agent/context';