import { storage } from "../storage.js";
import { generateEmbedding } from "./embedding.js";

interface RetrieveOptions {
  userId: string;
  organizationId?: string;
  projectId?: string | null;
  query: string;
  limit?: number;
  semanticLimit?: number;
  keywordLimit?: number;
  /**
   * Minimum cosine similarity a semantic-only chunk must meet to be kept in
   * the final result. Chunks that also matched a keyword search bypass this
   * filter (since a keyword match is itself strong evidence of relevance).
   *
   * Default: 0.3. Tuned so we drop obvious noise without starving the prompt.
   */
  minSimilarity?: number;
}

export interface RetrievedChunk {
  documentId: string;
  documentName: string;
  chunkId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  similarity?: number;
  source: "semantic" | "keyword";
  category?: string | null;
  uploadedAt?: Date;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  embeddingGenerated: boolean;
}

export async function retrieveRelevantChunks(options: RetrieveOptions): Promise<RetrievalResult> {
  const {
    userId,
    organizationId,
    projectId,
    query,
    limit = 8,
    semanticLimit = 8,
    keywordLimit = 4,
    minSimilarity = 0.3,
  } = options;

  if (!query.trim()) {
    return { query, chunks: [], embeddingGenerated: false };
  }

  const chunksMap = new Map<string, RetrievedChunk>();

  const embeddingResult = await generateEmbedding(query);
  const embeddingGenerated = !!embeddingResult.embedding;

  if (embeddingResult.embedding) {
    const semanticChunks = organizationId
      ? await storage.searchDocChunksByEmbeddingForOrganization(
          userId,
          organizationId,
          embeddingResult.embedding,
          semanticLimit,
          projectId
        )
      : await storage.searchDocChunksByEmbedding(
          userId,
          embeddingResult.embedding,
          semanticLimit
        );

    for (const record of semanticChunks) {
      const key = record.chunk.id;
      const existing = chunksMap.get(key);
      const similarity = record.similarity ?? 0;
      const chunk: RetrievedChunk = {
        documentId: record.document.id,
        documentName: record.document.originalName ?? record.document.filename ?? record.document.id,
        chunkId: record.chunk.id,
        chunkIndex: record.chunk.chunkIndex,
        content: record.chunk.content,
        tokenCount: record.chunk.tokenCount ?? record.chunk.content.split(/\s+/).length,
        similarity,
        source: "semantic",
        category: record.document.category,
        uploadedAt: record.document.uploadedAt ? new Date(record.document.uploadedAt) : undefined,
      };

      if (!existing || (existing.similarity ?? 0) < similarity) {
        chunksMap.set(key, chunk);
      }
    }
  }

  if (keywordLimit > 0) {
    const keywordChunks = organizationId
      ? await storage.searchDocChunksByKeywordForOrganization(
          userId,
          organizationId,
          query,
          keywordLimit,
          projectId
        )
      : await storage.searchDocChunksByKeyword(userId, query, keywordLimit);
    for (const record of keywordChunks) {
      const key = record.chunk.id;
      const existing = chunksMap.get(key);
      const chunk: RetrievedChunk = {
        documentId: record.document.id,
        documentName: record.document.originalName ?? record.document.filename ?? record.document.id,
        chunkId: record.chunk.id,
        chunkIndex: record.chunk.chunkIndex,
        content: record.chunk.content,
        tokenCount: record.chunk.tokenCount ?? record.chunk.content.split(/\s+/).length,
        similarity: existing?.similarity ?? record.similarity ?? 0.25,
        source: existing ? existing.source : "keyword",
        category: record.document.category,
        uploadedAt: record.document.uploadedAt ? new Date(record.document.uploadedAt) : undefined,
      };

      if (!existing) {
        chunksMap.set(key, chunk);
      } else if (existing.source !== "semantic") {
        chunksMap.set(key, chunk);
      }
    }
  }

  const merged = Array.from(chunksMap.values())
    .filter((chunk) => {
      // Keyword matches are retained regardless of embedding similarity —
      // the query literally appears in the chunk text, which is itself a
      // strong signal. We only apply the similarity floor to purely
      // semantic hits, which are where the noisy "low relevance" chunks
      // that pad prompts with unrelated context tend to come from.
      if (chunk.source === "keyword") return true;
      return (chunk.similarity ?? 0) >= minSimilarity;
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);

  return {
    query,
    chunks: merged,
    embeddingGenerated,
  };
}
