import { storage } from "../storage.js";
import { generateEmbedding } from "../services/embedding.js";

interface ProcessOptions {
  batchSize?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

interface TextChunk {
  content: string;
  tokenCount: number;
  sectionLabel?: string | null;
}

const DEFAULT_CHUNK_SIZE = 1200; // approx characters
const DEFAULT_CHUNK_OVERLAP = 200;

function chunkText(
  text: string,
  chunkSize: number,
  overlap: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  let index = 0;
  while (index < normalized.length) {
    const end = Math.min(index + chunkSize, normalized.length);
    const slice = normalized.slice(index, end).trim();
    const tokenCount = slice.split(/\s+/).length;

    if (slice.length > 0) {
      chunks.push({
        content: slice,
        tokenCount,
      });
    }

    if (end === normalized.length) {
      break;
    }

    index = end - overlap;
    if (index < 0) index = 0;
  }

  return chunks;
}

export async function processDocumentJobs(options: ProcessOptions = {}) {
  const {
    batchSize = 5,
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  } = options;

  const jobs = await storage.getProcessingJobs({
    jobType: "extraction",
    status: "queued",
    limit: batchSize,
  });

  if (!jobs.length) {
    console.log("[worker] No document jobs to process.");
    return;
  }

  for (const job of jobs) {
    try {
      await storage.updateProcessingJob(job.id, {
        status: "running",
        attempts: (job.attempts ?? 0) + 1,
        startedAt: new Date(),
      });

      const document = await storage.getDocument(job.documentId);
      if (!document) {
        throw new Error(`Document ${job.documentId} not found`);
      }

      const extraction = await storage.getDocumentExtraction(job.documentId);
      if (!extraction || extraction.extractionStatus !== "complete") {
        throw new Error(`Extraction not ready for document ${job.documentId}`);
      }

      const chunks = chunkText(extraction.rawText || "", chunkSize, chunkOverlap);

      await storage.deleteChunksForDocument(job.documentId);

      let embeddingModel: string | null = null;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let embedding: number[] | null = null;

        try {
          const result = await generateEmbedding(chunk.content);
          embedding = result.embedding;
          embeddingModel = result.model;
        } catch (embeddingError) {
          console.error(
            `[worker] Embedding failed for document ${job.documentId}, chunk ${i}:`,
            embeddingError
          );
        }

        await storage.insertDocChunk(job.documentId, {
          chunkIndex: i,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          sectionLabel: chunk.sectionLabel ?? null,
          embedding,
        });
      }

      await storage.updateDocument(job.documentId, {
        chunkCount: chunks.length,
        embeddingStatus: embeddingModel ? "complete" : "skipped",
        embeddingGeneratedAt: new Date(),
        embeddingModel: embeddingModel ?? null,
      });

      await storage.updateProcessingJob(job.id, {
        status: "succeeded",
        finishedAt: new Date(),
        lastError: null,
      });

      console.log(
        `[worker] Processed document ${job.documentId} with ${chunks.length} chunks.`
      );
    } catch (error) {
      console.error(
        `[worker] Failed to process document job ${job.id}:`,
        error
      );
      await storage.updateProcessingJob(job.id, {
        status: "failed",
        finishedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      });
      await storage.updateDocument(job.documentId, {
        embeddingStatus: "failed",
        processingError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
