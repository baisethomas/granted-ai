-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop the existing embedding column that uses jsonb
ALTER TABLE "doc_chunks" DROP COLUMN IF EXISTS "embedding";

-- Add new vector embedding column with 1536 dimensions (OpenAI text-embedding-3-small)
ALTER TABLE "doc_chunks" ADD COLUMN "embedding" vector(1536);

-- Add additional metadata columns for better chunk management
ALTER TABLE "doc_chunks" ADD COLUMN "chunk_size" integer;
ALTER TABLE "doc_chunks" ADD COLUMN "section_title" text;
ALTER TABLE "doc_chunks" ADD COLUMN "page_number" integer;
ALTER TABLE "doc_chunks" ADD COLUMN "metadata" jsonb DEFAULT '{}';

-- Add indexes for efficient vector similarity search
CREATE INDEX CONCURRENTLY IF NOT EXISTS "doc_chunks_embedding_cosine_idx" 
ON "doc_chunks" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "doc_chunks_document_id_idx" 
ON "doc_chunks" ("document_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "doc_chunks_section_title_idx" 
ON "doc_chunks" ("section_title");

-- Add embedding processing status to documents table
ALTER TABLE "documents" ADD COLUMN "embedding_status" text DEFAULT 'pending';
ALTER TABLE "documents" ADD COLUMN "chunk_count" integer DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN "embedding_model" text DEFAULT 'text-embedding-3-small';

-- Create a new table for embedding cache to avoid duplicate API calls
CREATE TABLE IF NOT EXISTS "embedding_cache" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "content_hash" text NOT NULL UNIQUE,
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "model" text NOT NULL DEFAULT 'text-embedding-3-small',
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "embedding_cache_content_hash_idx" 
ON "embedding_cache" ("content_hash");

-- Create a table for retrieval sessions to track what chunks were used in generation
CREATE TABLE IF NOT EXISTS "retrieval_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" varchar NOT NULL,
  "query_text" text NOT NULL,
  "retrieved_chunks" jsonb NOT NULL, -- Array of chunk IDs with similarity scores
  "context_used" text NOT NULL,
  "retrieval_time_ms" integer,
  "created_at" timestamp DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE "retrieval_sessions" ADD CONSTRAINT "retrieval_sessions_question_id_grant_questions_id_fk" 
FOREIGN KEY ("question_id") REFERENCES "public"."grant_questions"("id") ON DELETE CASCADE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "retrieval_sessions_question_id_idx" 
ON "retrieval_sessions" ("question_id");

-- Update doc_chunks to add some constraints
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_chunk_index_positive" CHECK ("chunk_index" >= 0);
ALTER TABLE "doc_chunks" ADD CONSTRAINT "doc_chunks_chunk_size_positive" CHECK ("chunk_size" > 0);

-- Add comments for documentation
COMMENT ON COLUMN "doc_chunks"."embedding" IS 'Vector embedding using OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN "doc_chunks"."section_title" IS 'Title of the document section this chunk belongs to';
COMMENT ON COLUMN "doc_chunks"."page_number" IS 'Page number in the original document (if applicable)';
COMMENT ON COLUMN "doc_chunks"."metadata" IS 'Additional metadata like headings, formatting info, etc.';
COMMENT ON TABLE "embedding_cache" IS 'Cache for embeddings to avoid duplicate API calls for same content';
COMMENT ON TABLE "retrieval_sessions" IS 'Tracks which chunks were retrieved and used for each question generation';

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) RETURNS TABLE (
  id varchar,
  document_id varchar,
  content text,
  chunk_index int,
  section_title text,
  page_number int,
  metadata jsonb,
  similarity float
) LANGUAGE sql STABLE AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.section_title,
    dc.page_number,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding)) AS similarity
  FROM doc_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND dc.embedding IS NOT NULL
    AND d.embedding_status = 'complete'
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Create function to get organization chunk statistics
CREATE OR REPLACE FUNCTION get_organization_chunk_stats(org_id varchar)
RETURNS TABLE (
  total_chunks bigint,
  total_documents bigint,
  avg_similarity float
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(DISTINCT dc.id) AS total_chunks,
    COUNT(DISTINCT d.id) AS total_documents,
    0.0 AS avg_similarity -- Placeholder, would need query embedding to calculate
  FROM doc_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE d.organization_id = org_id
    AND dc.embedding IS NOT NULL
    AND d.embedding_status = 'complete';
$$;

-- Create function for hybrid search (combining semantic + keyword search)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  search_terms text[] DEFAULT '{}',
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  org_id varchar DEFAULT NULL
) RETURNS TABLE (
  id varchar,
  document_id varchar,
  content text,
  chunk_index int,
  section_title text,
  page_number int,
  metadata jsonb,
  similarity float,
  keyword_score float,
  combined_score float
) LANGUAGE sql STABLE AS $$
  WITH semantic_scores AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.chunk_index,
      dc.section_title,
      dc.page_number,
      dc.metadata,
      (1 - (dc.embedding <=> query_embedding)) AS similarity
    FROM doc_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
      AND dc.embedding IS NOT NULL
      AND d.embedding_status = 'complete'
      AND (org_id IS NULL OR d.organization_id = org_id)
  ),
  keyword_scores AS (
    SELECT
      ss.*,
      CASE 
        WHEN array_length(search_terms, 1) > 0 THEN
          (
            SELECT COALESCE(SUM(
              (length(lower(ss.content)) - length(replace(lower(ss.content), lower(term), ''))) / length(lower(term))
            ), 0) * 0.1
            FROM unnest(search_terms) AS term
          )
        ELSE 0
      END AS keyword_score
    FROM semantic_scores ss
  )
  SELECT
    ks.*,
    -- Combined score: 70% semantic similarity + 30% keyword relevance
    (ks.similarity * 0.7 + LEAST(ks.keyword_score, 1.0) * 0.3) AS combined_score
  FROM keyword_scores ks
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;