-- Phase 2: Document ingestion & retrieval schema updates
BEGIN;

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Augment documents table for storage + processing lifecycle
ALTER TABLE IF EXISTS documents
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'documents',
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_url TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary_extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;

-- Backfill processing status from legacy boolean when available
UPDATE documents
SET processing_status = CASE
  WHEN processed IS TRUE THEN 'complete'
  ELSE processing_status
END;

-- 2. Raw text archive (stores the full extracted text prior to chunking)
CREATE TABLE IF NOT EXISTS document_extractions (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  raw_text TEXT,
  raw_text_bytes INTEGER,
  extracted_at TIMESTAMPTZ DEFAULT now(),
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error TEXT
);

-- 3. Drop legacy doc_chunks if it exists with integer PK (from earlier spike)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'doc_chunks'
  ) THEN
    DROP TABLE doc_chunks CASCADE;
  END IF;
END $$;

-- 4. Recreate doc_chunks aligned with UUID documents
CREATE TABLE doc_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  section_label TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX doc_chunks_document_idx_idx
  ON doc_chunks(document_id, chunk_index);

CREATE INDEX doc_chunks_document_id_idx
  ON doc_chunks(document_id);

CREATE INDEX doc_chunks_embedding_idx
  ON doc_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 5. Track asynchronous processing jobs (extraction, embedding, summarisation)
CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- extraction | embedding | summarisation
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | succeeded | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX document_processing_jobs_document_id_idx
  ON document_processing_jobs(document_id);

CREATE INDEX document_processing_jobs_status_idx
  ON document_processing_jobs(status);

-- 6. Optional: lightweight embeddings cache for deduplication
CREATE TABLE IF NOT EXISTS embedding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT UNIQUE NOT NULL,
  content_preview TEXT,
  embedding VECTOR(1536),
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  usage_count INTEGER DEFAULT 1
);

CREATE INDEX embedding_cache_hash_idx
  ON embedding_cache(content_hash);

COMMIT;
