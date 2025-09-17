import { RAGPipeline, DocumentProcessingResult } from './pipeline';
import { EmbeddingService, BatchEmbeddingRequest } from './embeddings';
import { supabaseBrowserClient } from '../supabase/client';

export interface BatchJob {
  id: string;
  type: 'document_processing' | 'embedding_generation' | 'reprocessing';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  organizationId: string;
  items: BatchJobItem[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}

export interface BatchJobItem {
  id: string;
  type: 'document' | 'chunk';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: any;
  result?: any;
  error?: string;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number; // milliseconds
  priorityQueue?: boolean;
  rateLimitDelay?: number; // milliseconds between API calls
}

export interface BatchResult {
  jobId: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  processingTimeMs: number;
  results: Array<{
    itemId: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
}

export class BatchProcessor {
  private activeJobs = new Map<string, BatchJob>();
  private ragPipeline: RAGPipeline;
  private embeddingService: EmbeddingService;
  private defaultOptions: Required<BatchProcessingOptions> = {
    batchSize: 20,
    concurrency: 3,
    retryAttempts: 2,
    retryDelay: 2000,
    priorityQueue: false,
    rateLimitDelay: 1000,
  };

  constructor(embeddingService?: EmbeddingService) {
    this.ragPipeline = new RAGPipeline();
    this.embeddingService = embeddingService || new EmbeddingService();
  }

  /**
   * Queue multiple documents for processing
   */
  public async queueDocumentProcessing(
    documents: Array<{
      id: string;
      content: string;
      filename: string;
    }>,
    organizationId: string,
    options: BatchProcessingOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    const opts = { ...this.defaultOptions, ...options };

    const job: BatchJob = {
      id: jobId,
      type: 'document_processing',
      status: 'queued',
      organizationId,
      items: documents.map(doc => ({
        id: doc.id,
        type: 'document',
        status: 'pending',
        data: doc,
      })),
      createdAt: new Date(),
      progress: {
        total: documents.length,
        completed: 0,
        failed: 0,
      },
    };

    this.activeJobs.set(jobId, job);

    // Start processing in background
    this.processJob(jobId, opts).catch(error => {
      console.error(`Batch job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  /**
   * Queue embedding generation for multiple chunks
   */
  public async queueEmbeddingGeneration(
    chunks: BatchEmbeddingRequest[],
    organizationId: string,
    options: BatchProcessingOptions = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    const opts = { ...this.defaultOptions, ...options };

    const job: BatchJob = {
      id: jobId,
      type: 'embedding_generation',
      status: 'queued',
      organizationId,
      items: chunks.map(chunk => ({
        id: chunk.id,
        type: 'chunk',
        status: 'pending',
        data: chunk,
      })),
      createdAt: new Date(),
      progress: {
        total: chunks.length,
        completed: 0,
        failed: 0,
      },
    };

    this.activeJobs.set(jobId, job);

    // Start processing in background
    this.processJob(jobId, opts).catch(error => {
      console.error(`Batch job ${jobId} failed:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    });

    return jobId;
  }

  /**
   * Process a batch job
   */
  private async processJob(
    jobId: string,
    options: Required<BatchProcessingOptions>
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    console.log(`Starting batch job ${jobId} with ${job.items.length} items`);

    try {
      this.updateJobStatus(jobId, 'processing');

      const batches = this.createBatches(job.items, options.batchSize);
      
      // Process batches with controlled concurrency
      await this.processBatchesWithConcurrency(jobId, batches, options);

      // Final status update
      const finalJob = this.activeJobs.get(jobId);
      if (finalJob) {
        const hasFailures = finalJob.progress.failed > 0;
        this.updateJobStatus(jobId, hasFailures ? 'completed' : 'completed');
      }

      console.log(`Batch job ${jobId} completed`);
    } catch (error: any) {
      console.error(`Batch job ${jobId} error:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    }
  }

  /**
   * Create batches from job items
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process batches with controlled concurrency
   */
  private async processBatchesWithConcurrency(
    jobId: string,
    batches: BatchJobItem[][],
    options: Required<BatchProcessingOptions>
  ): Promise<void> {
    const concurrentPromises: Promise<void>[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batchPromise = this.processSingleBatch(jobId, batches[i], options, i);
      concurrentPromises.push(batchPromise);

      // Limit concurrency
      if (concurrentPromises.length >= options.concurrency) {
        await Promise.race(concurrentPromises);
        // Remove completed promises
        for (let j = concurrentPromises.length - 1; j >= 0; j--) {
          try {
            await Promise.race([concurrentPromises[j], Promise.resolve()]);
            concurrentPromises.splice(j, 1);
            break;
          } catch {
            // Promise not yet resolved
          }
        }
      }

      // Rate limiting between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, options.rateLimitDelay));
      }
    }

    // Wait for all remaining promises
    await Promise.allSettled(concurrentPromises);
  }

  /**
   * Process a single batch of items
   */
  private async processSingleBatch(
    jobId: string,
    batch: BatchJobItem[],
    options: Required<BatchProcessingOptions>,
    batchIndex: number
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    console.log(`Processing batch ${batchIndex + 1} with ${batch.length} items for job ${jobId}`);

    for (const item of batch) {
      try {
        await this.processJobItem(jobId, item, options);
      } catch (error: any) {
        console.error(`Error processing item ${item.id} in job ${jobId}:`, error);
        this.updateItemStatus(jobId, item.id, 'failed', error.message);
      }
    }
  }

  /**
   * Process a single job item with retry logic
   */
  private async processJobItem(
    jobId: string,
    item: BatchJobItem,
    options: Required<BatchProcessingOptions>
  ): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.retryAttempts; attempt++) {
      try {
        this.updateItemStatus(jobId, item.id, 'processing');

        let result: any;

        switch (job.type) {
          case 'document_processing':
            result = await this.processDocument(item.data);
            break;
          case 'embedding_generation':
            result = await this.processEmbedding(item.data);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }

        // Success
        this.updateItemStatus(jobId, item.id, 'completed', undefined, result);
        return;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < options.retryAttempts) {
          console.warn(`Attempt ${attempt + 1} failed for item ${item.id}, retrying...`);
          await new Promise(resolve => 
            setTimeout(resolve, options.retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    // All retries failed
    this.updateItemStatus(jobId, item.id, 'failed', lastError?.message);
  }

  /**
   * Process a single document
   */
  private async processDocument(documentData: any): Promise<DocumentProcessingResult> {
    return await this.ragPipeline.processDocument(
      documentData.id,
      documentData.content,
      documentData.filename
    );
  }

  /**
   * Process embedding generation
   */
  private async processEmbedding(chunkData: BatchEmbeddingRequest): Promise<any> {
    const result = await this.embeddingService.generateEmbedding(chunkData.content);
    return {
      chunkId: chunkData.id,
      embedding: result.embedding,
      tokens: result.tokens,
      cached: result.cached,
    };
  }

  /**
   * Update job status
   */
  private updateJobStatus(
    jobId: string,
    status: BatchJob['status'],
    error?: string
  ): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = status;
    if (error) job.error = error;

    if (status === 'processing' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    this.activeJobs.set(jobId, job);
  }

  /**
   * Update item status and job progress
   */
  private updateItemStatus(
    jobId: string,
    itemId: string,
    status: BatchJobItem['status'],
    error?: string,
    result?: any
  ): void {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const item = job.items.find(i => i.id === itemId);
    if (!item) return;

    const oldStatus = item.status;
    item.status = status;
    if (error) item.error = error;
    if (result) item.result = result;

    // Update progress counters
    if (oldStatus !== status) {
      if (status === 'completed' && oldStatus !== 'completed') {
        job.progress.completed++;
      } else if (status === 'failed' && oldStatus !== 'failed') {
        job.progress.failed++;
      }
    }

    this.activeJobs.set(jobId, job);
  }

  /**
   * Get job status
   */
  public getJobStatus(jobId: string): BatchJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get job result
   */
  public getJobResult(jobId: string): BatchResult | null {
    const job = this.activeJobs.get(jobId);
    if (!job) return null;

    const processingTime = job.completedAt && job.startedAt 
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : 0;

    return {
      jobId,
      totalItems: job.progress.total,
      successfulItems: job.progress.completed,
      failedItems: job.progress.failed,
      processingTimeMs: processingTime,
      results: job.items.map(item => ({
        itemId: item.id,
        success: item.status === 'completed',
        result: item.result,
        error: item.error,
      })),
    };
  }

  /**
   * Cancel a job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed') {
      return false;
    }

    job.status = 'failed';
    job.error = 'Job cancelled by user';
    job.completedAt = new Date();
    
    this.activeJobs.set(jobId, job);
    return true;
  }

  /**
   * Clean up completed jobs older than specified time
   */
  public cleanupOldJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    let cleaned = 0;
    const cutoffTime = Date.now() - maxAgeMs;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt.getTime() < cutoffTime
      ) {
        this.activeJobs.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get active jobs count
   */
  public getActiveJobsCount(): number {
    return Array.from(this.activeJobs.values()).filter(
      job => job.status === 'queued' || job.status === 'processing'
    ).length;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Process organization documents in batch with smart prioritization
   */
  public async processOrganizationDocuments(
    organizationId: string,
    options: BatchProcessingOptions & {
      prioritizeByType?: boolean;
      skipProcessed?: boolean;
    } = {}
  ): Promise<string> {
    try {
      if (!supabaseBrowserClient) {
        throw new Error('Supabase client not available');
      }

      // Get unprocessed documents
      let query = supabaseBrowserClient
        .from('documents')
        .select('id, filename, original_name, file_type, category, embedding_status')
        .eq('organization_id', organizationId);

      if (options.skipProcessed) {
        query = query.in('embedding_status', ['pending', 'error']);
      }

      const { data: documents, error } = await query;

      if (error || !documents) {
        throw error || new Error('No documents found');
      }

      // Prioritize documents by importance if requested
      if (options.prioritizeByType) {
        const typePriority: Record<string, number> = {
          'organization-info': 1,
          'past-successes': 2,
          'team-info': 3,
          'budgets': 4,
        };

        documents.sort((a, b) => {
          const priorityA = typePriority[a.category] || 5;
          const priorityB = typePriority[b.category] || 5;
          return priorityA - priorityB;
        });
      }

      // Note: In a real implementation, you'd need to fetch the actual document content
      // This is simplified assuming content is available
      const documentsWithContent = documents.map(doc => ({
        id: doc.id,
        content: '', // Would be fetched from storage
        filename: doc.original_name,
      })).filter(doc => doc.content); // Filter out documents without content

      return await this.queueDocumentProcessing(
        documentsWithContent,
        organizationId,
        options
      );
    } catch (error: any) {
      console.error('Error queuing organization documents:', error);
      throw error;
    }
  }
}