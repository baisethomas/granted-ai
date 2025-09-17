-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Enhanced doc_chunks table for RAG pipeline
CREATE TABLE IF NOT EXISTS doc_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    chunk_type TEXT DEFAULT 'paragraph', -- paragraph, section, table, list
    metadata JSONB DEFAULT '{}',
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient vector similarity search
CREATE INDEX IF NOT EXISTS doc_chunks_embedding_idx ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS doc_chunks_document_id_idx ON doc_chunks(document_id);
CREATE INDEX IF NOT EXISTS doc_chunks_chunk_index_idx ON doc_chunks(chunk_index);

-- Embedding cache to reduce API costs
CREATE TABLE IF NOT EXISTS embedding_cache (
    id SERIAL PRIMARY KEY,
    content_hash TEXT UNIQUE NOT NULL,
    content_preview TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS embedding_cache_hash_idx ON embedding_cache(content_hash);
CREATE INDEX IF NOT EXISTS embedding_cache_last_used_idx ON embedding_cache(last_used_at);

-- Retrieval sessions for analytics and tracking
CREATE TABLE IF NOT EXISTS retrieval_sessions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    results_count INTEGER DEFAULT 0,
    avg_similarity DECIMAL(4,3),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS retrieval_sessions_org_id_idx ON retrieval_sessions(organization_id);
CREATE INDEX IF NOT EXISTS retrieval_sessions_created_at_idx ON retrieval_sessions(created_at);

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_chunks(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10,
    org_id int DEFAULT NULL
)
RETURNS TABLE (
    chunk_id int,
    document_id int,
    content text,
    similarity float,
    metadata jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id as chunk_id,
        dc.document_id,
        dc.content,
        (1 - (dc.embedding <=> query_embedding)) as similarity,
        dc.metadata
    FROM doc_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE (org_id IS NULL OR d.org_id = org_id)
    AND (1 - (dc.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;