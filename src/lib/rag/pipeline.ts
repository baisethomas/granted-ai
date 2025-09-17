import { DocumentChunker, DocumentChunk } from './chunking';
import { EmbeddingService, BatchEmbeddingRequest } from './embeddings';
import { VectorRetrievalService, RetrievalResult, HybridSearchOptions } from './retrieval';
import { supabaseBrowserClient } from '../supabase/client';
import { docChunks, documents, retrievalSessions } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface DocumentProcessingResult {
  documentId: string;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTimeMs: number;
  status: 'success' | 'partial' | 'failed';
  error?: string;
}

export interface ContextGenerationResult {
  context: string;
  relevantChunks: Array<{
    id: string;
    content: string;
    similarity: number;
    source: string;
  }>;
  totalTokens: number;
  retrievalTimeMs: number;
  sources: string[];
}

export interface RAGPipelineOptions {
  chunkingOptions?: {
    maxTokens?: number;
    overlapTokens?: number;
    preserveStructure?: boolean;
  };
  embeddingOptions?: {
    batchSize?: number;
  };
  retrievalOptions?: {
    limit?: number;
    similarityThreshold?: number;
    diversityFactor?: number;
    maxTokens?: number;
  };
}

export class RAGPipeline {
  private chunker: DocumentChunker;
  private embeddingService: EmbeddingService;
  private retrievalService: VectorRetrievalService;

  constructor(embeddingService?: EmbeddingService) {
    this.chunker = new DocumentChunker();
    this.embeddingService = embeddingService || new EmbeddingService();
    this.retrievalService = new VectorRetrievalService(this.embeddingService);
  }

  /**
   * Process a document end-to-end: chunking -> embedding -> storage
   */
  public async processDocument(
    documentId: string,
    content: string,
    filename: string,
    options: RAGPipelineOptions = {}
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let chunksCreated = 0;
    let embeddingsGenerated = 0;

    try {
      console.log(`Processing document ${documentId}: ${filename}`);

      // Update document status
      await this.updateDocumentStatus(documentId, 'processing');

      // Step 1: Chunk the document
      const chunks = this.chunker.chunkDocument(
        content,
        filename,
        options.chunkingOptions
      );

      if (chunks.length === 0) {
        await this.updateDocumentStatus(documentId, 'error', 0);
        return {
          documentId,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          processingTimeMs: Date.now() - startTime,
          status: 'failed',
          error: 'No chunks created from document content',
        };
      }

      console.log(`Created ${chunks.length} chunks`);

      // Step 2: Generate embeddings in batches
      const batchSize = options.embeddingOptions?.batchSize || 50;
      const embeddingRequests: BatchEmbeddingRequest[] = chunks.map((chunk, index) => ({
        id: `${documentId}-${index}`,
        content: chunk.content,
        contentHash: this.chunker.generateContentHash(chunk.content),
      }));

      const embeddingResults = await this.embeddingService.generateBatchEmbeddings(
        embeddingRequests
      );

      // Step 3: Store chunks with embeddings
      const validResults = embeddingResults.filter(result => 
        result.embedding && result.embedding.length > 0 && !result.error
      );

      if (validResults.length === 0) {
        await this.updateDocumentStatus(documentId, 'error', 0);
        return {
          documentId,
          chunksCreated: chunks.length,
          embeddingsGenerated: 0,
          processingTimeMs: Date.now() - startTime,
          status: 'failed',
          error: 'Failed to generate embeddings for any chunks',
        };
      }

      // Store chunks in database
      for (let i = 0; i < validResults.length; i++) {
        const result = validResults[i];
        const chunk = chunks[i];

        if (result.embedding && result.embedding.length > 0) {
          await this.storeChunk(documentId, chunk, result.embedding);
          chunksCreated++;
          if (!result.cached) {
            embeddingsGenerated++;
          }
        }
      }

      // Update document status
      const status = chunksCreated === chunks.length ? 'complete' : 'partial';
      await this.updateDocumentStatus(documentId, status, chunksCreated);

      console.log(`Document processed: ${chunksCreated}/${chunks.length} chunks stored`);

      return {
        documentId,
        chunksCreated,
        embeddingsGenerated,
        processingTimeMs: Date.now() - startTime,
        status: chunksCreated > 0 ? (chunksCreated === chunks.length ? 'success' : 'partial') : 'failed',
      };
    } catch (error: any) {
      console.error(`Error processing document ${documentId}:`, error);
      await this.updateDocumentStatus(documentId, 'error', chunksCreated);
      
      return {
        documentId,
        chunksCreated,
        embeddingsGenerated,
        processingTimeMs: Date.now() - startTime,
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Generate context for a grant question using RAG
   */
  public async generateContext(
    question: string,
    organizationId: string,
    options: HybridSearchOptions = {}
  ): Promise<ContextGenerationResult> {
    const startTime = Date.now();

    try {
      console.log(`Generating context for question: ${question.substring(0, 100)}...`);

      // Extract keywords from the question for hybrid search
      const keywords = this.extractKeywords(question);
      
      // Perform hybrid search
      const retrievalOptions: HybridSearchOptions = {
        organizationId,
        limit: 8,
        similarityThreshold: 0.6,
        diversityFactor: 0.3,
        maxTokens: 3000,
        keywords,
        keywordWeight: 0.2,
        boostFactors: {
          documentType: {
            'organization-profile': 1.2,
            'program': 1.1,
            'assessment': 1.1,
            'budget': 0.9,
          },
          sectionRelevance: 1.15,
        },
        ...options,
      };

      const retrievalResult = await this.retrievalService.hybridSearch(
        question,
        retrievalOptions
      );

      if (retrievalResult.chunks.length === 0) {
        return {
          context: 'No relevant context found in uploaded documents. Please ensure you have uploaded relevant organizational documents.',
          relevantChunks: [],
          totalTokens: 0,
          retrievalTimeMs: Date.now() - startTime,
          sources: [],
        };
      }

      // Build structured context
      const context = this.buildStructuredContext(retrievalResult.chunks, question);
      
      // Extract unique sources
      const sources = Array.from(new Set(
        retrievalResult.chunks.map(chunk => chunk.documentId)
      ));

      const result: ContextGenerationResult = {
        context,
        relevantChunks: retrievalResult.chunks.map(chunk => ({
          id: chunk.id,
          content: chunk.content.substring(0, 500) + '...',
          similarity: chunk.similarity,
          source: chunk.sectionTitle || `Document ${chunk.documentId.slice(0, 8)}`,
        })),
        totalTokens: retrievalResult.totalTokens,
        retrievalTimeMs: Date.now() - startTime,
        sources,
      };

      console.log(`Context generated: ${retrievalResult.chunks.length} chunks, ${result.totalTokens} tokens`);
      return result;
    } catch (error: any) {
      console.error('Error generating context:', error);
      
      return {
        context: `Error retrieving context: ${error.message}. Please try again or ensure your documents have been processed.`,
        relevantChunks: [],
        totalTokens: 0,
        retrievalTimeMs: Date.now() - startTime,
        sources: [],
      };
    }
  }

  /**
   * Update document processing status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'processing' | 'complete' | 'partial' | 'error',
    chunkCount: number = 0
  ): Promise<void> {
    try {
      if (!supabaseBrowserClient) {
        console.warn('Supabase client not available for status update');
        return;
      }

      const { error } = await supabaseBrowserClient
        .from('documents')
        .update({
          embedding_status: status,
          chunk_count: chunkCount,
        })
        .eq('id', documentId);

      if (error) {
        console.error('Error updating document status:', error);
      }
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  }

  /**
   * Store a chunk with its embedding in the database
   */
  private async storeChunk(
    documentId: string,
    chunk: DocumentChunk,
    embedding: number[]
  ): Promise<void> {
    try {
      if (!supabaseBrowserClient) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabaseBrowserClient
        .from('doc_chunks')
        .insert({
          document_id: documentId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding,
          chunk_size: chunk.chunkSize,
          section_title: chunk.sectionTitle,
          page_number: chunk.pageNumber,
          metadata: chunk.metadata,
        });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error(`Error storing chunk ${chunk.chunkIndex}:`, error);
      throw new Error(`Failed to store chunk: ${error.message}`);
    }
  }

  /**
   * Extract keywords from a question for hybrid search
   */
  private extractKeywords(question: string): string[] {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this', 'these', 'those',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
      'your', 'our', 'their', 'its', 'my', 'his', 'her',
    ]);

    const words = question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !commonWords.has(word) &&
        !/^\d+$/.test(word) // exclude pure numbers
      );

    // Take the most important words (usually nouns and verbs)
    return words.slice(0, 8);
  }

  /**
   * Build structured context from retrieved chunks
   */
  private buildStructuredContext(chunks: any[], question: string): string {
    if (chunks.length === 0) {
      return 'No relevant context available.';
    }

    // Group chunks by document/section for better organization
    const groupedChunks: Record<string, any[]> = {};
    
    for (const chunk of chunks) {
      const key = chunk.sectionTitle || 'General Information';
      if (!groupedChunks[key]) {
        groupedChunks[key] = [];
      }
      groupedChunks[key].push(chunk);
    }

    // Build context with clear section headers
    const sections: string[] = [];
    
    for (const [sectionTitle, sectionChunks] of Object.entries(groupedChunks)) {
      const sectionContent = sectionChunks
        .sort((a, b) => b.similarity - a.similarity)
        .map(chunk => chunk.content.trim())
        .join('\n\n');
      
      sections.push(`## ${sectionTitle}\n${sectionContent}`);
    }

    const context = sections.join('\n\n---\n\n');
    
    // Add helpful instruction for the AI
    const instruction = `The following information has been retrieved from the organization's documents to help answer the question: "${question}"\n\n`;
    
    return instruction + context;
  }

  /**
   * Store retrieval session for tracking and analysis
   */
  public async recordRetrievalSession(
    questionId: string,
    queryText: string,
    retrievedChunks: Array<{ id: string; similarity: number }>,
    contextUsed: string,
    retrievalTimeMs: number
  ): Promise<void> {
    try {
      if (!supabaseBrowserClient) {
        return;
      }

      const { error } = await supabaseBrowserClient
        .from('retrieval_sessions')
        .insert({
          question_id: questionId,
          query_text: queryText,
          retrieved_chunks: retrievedChunks,
          context_used: contextUsed.substring(0, 5000), // Limit size
          retrieval_time_ms: retrievalTimeMs,
        });

      if (error) {
        console.error('Error recording retrieval session:', error);
      }
    } catch (error) {
      console.error('Error recording retrieval session:', error);
    }
  }

  /**
   * Get processing status for multiple documents
   */
  public async getProcessingStatus(documentIds: string[]): Promise<Record<string, {
    status: string;
    chunkCount: number;
    embeddingModel: string;
  }>> {
    try {
      if (!supabaseBrowserClient) {
        return {};
      }

      const { data, error } = await supabaseBrowserClient
        .from('documents')
        .select('id, embedding_status, chunk_count, embedding_model')
        .in('id', documentIds);

      if (error) {
        console.error('Error getting processing status:', error);
        return {};
      }

      const statusMap: Record<string, any> = {};
      for (const doc of data) {
        statusMap[doc.id] = {
          status: doc.embedding_status,
          chunkCount: doc.chunk_count,
          embeddingModel: doc.embedding_model,
        };
      }

      return statusMap;
    } catch (error) {
      console.error('Error getting processing status:', error);
      return {};
    }
  }

  /**
   * Reprocess failed documents
   */
  public async reprocessFailedDocuments(organizationId: string): Promise<{
    reprocessed: number;
    failed: number;
  }> {
    let reprocessed = 0;
    let failed = 0;

    try {
      if (!supabaseBrowserClient) {
        throw new Error('Supabase client not available');
      }

      // Find documents that failed processing
      const { data: failedDocs, error } = await supabaseBrowserClient
        .from('documents')
        .select('id, filename, summary')
        .eq('organization_id', organizationId)
        .in('embedding_status', ['error', 'pending']);

      if (error || !failedDocs) {
        throw error || new Error('No failed documents found');
      }

      console.log(`Found ${failedDocs.length} documents to reprocess`);

      // Reprocess each document
      for (const doc of failedDocs) {
        try {
          // Note: In a real implementation, you'd need to get the original content
          // This is a simplified version assuming content is available
          const content = doc.summary || ''; // Fallback - would need actual content
          
          if (content) {
            const result = await this.processDocument(doc.id, content, doc.filename);
            if (result.status === 'success' || result.status === 'partial') {
              reprocessed++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Error reprocessing document ${doc.id}:`, error);
          failed++;
        }

        // Add delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return { reprocessed, failed };
    } catch (error: any) {
      console.error('Error in reprocessFailedDocuments:', error);
      return { reprocessed, failed };
    }
  }
}