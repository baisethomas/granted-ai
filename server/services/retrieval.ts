import { storage } from "../storage.js";
import { generateEmbedding } from "./embedding.js";

interface RetrieveOptions {
  userId: string;
  query: string;
  limit?: number;
  semanticLimit?: number;
  keywordLimit?: number;
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
  const { userId, query, limit = 8, semanticLimit = 8, keywordLimit = 4 } = options;

  if (!query.trim()) {
    return { query, chunks: [], embeddingGenerated: false };
  }

  const chunksMap = new Map<string, RetrievedChunk>();

  const embeddingResult = await generateEmbedding(query);
  const embeddingGenerated = !!embeddingResult.embedding;

  if (embeddingResult.embedding) {
    const semanticChunks = await storage.searchDocChunksByEmbedding(
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
    const keywordChunks = await storage.searchDocChunksByKeyword(userId, query, keywordLimit);
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
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);

  return {
    query,
    chunks: merged,
    embeddingGenerated,
  };
}
