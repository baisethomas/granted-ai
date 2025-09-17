-- Citation system tables for paragraph-level source attribution

-- Enhanced draft_citations table for paragraph-level tracking
ALTER TABLE IF EXISTS draft_citations DROP CONSTRAINT IF EXISTS draft_citations_draft_id_fkey;
DROP TABLE IF EXISTS draft_citations;

CREATE TABLE draft_citations (
    id SERIAL PRIMARY KEY,
    draft_id INTEGER NOT NULL,
    section_name TEXT NOT NULL,
    paragraph_index INTEGER NOT NULL,
    sentence_index INTEGER DEFAULT 0,
    source_document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_refs JSONB DEFAULT '[]',
    confidence_score DECIMAL(4,3) DEFAULT 0.0,
    citation_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Paragraph-level citations for detailed tracking
CREATE TABLE paragraph_citations (
    id SERIAL PRIMARY KEY,
    draft_id INTEGER NOT NULL,
    paragraph_id TEXT NOT NULL, -- unique identifier for paragraph
    paragraph_text TEXT NOT NULL,
    citations JSONB DEFAULT '[]', -- array of citation objects
    grounding_quality DECIMAL(4,3) DEFAULT 0.0,
    assumption_flags JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Citation sources for managing source metadata
CREATE TABLE citation_sources (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id INTEGER REFERENCES doc_chunks(id) ON DELETE CASCADE,
    page_number INTEGER,
    section_title TEXT,
    source_type TEXT DEFAULT 'document', -- document, website, report, etc.
    credibility_score DECIMAL(4,3) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence maps for visual representation
CREATE TABLE evidence_maps (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    draft_version INTEGER DEFAULT 1,
    section_name TEXT NOT NULL,
    evidence_strength DECIMAL(4,3) DEFAULT 0.0,
    source_count INTEGER DEFAULT 0,
    assumption_count INTEGER DEFAULT 0,
    quality_issues JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Citation validation results
CREATE TABLE citation_validations (
    id SERIAL PRIMARY KEY,
    citation_id INTEGER NOT NULL REFERENCES paragraph_citations(id) ON DELETE CASCADE,
    validation_type TEXT NOT NULL, -- accuracy, relevance, authority
    is_valid BOOLEAN DEFAULT true,
    confidence_score DECIMAL(4,3) DEFAULT 0.0,
    issues JSONB DEFAULT '[]',
    suggestions TEXT,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Citation formats for export
CREATE TABLE citation_formats (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    format_name TEXT NOT NULL, -- apa, mla, grant_standard
    format_rules JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS draft_citations_draft_id_idx ON draft_citations(draft_id);
CREATE INDEX IF NOT EXISTS paragraph_citations_draft_id_idx ON paragraph_citations(draft_id);
CREATE INDEX IF NOT EXISTS citation_sources_document_id_idx ON citation_sources(document_id);
CREATE INDEX IF NOT EXISTS evidence_maps_project_id_idx ON evidence_maps(project_id);
CREATE INDEX IF NOT EXISTS citation_validations_citation_id_idx ON citation_validations(citation_id);

-- Function to calculate grounding quality for a draft
CREATE OR REPLACE FUNCTION calculate_grounding_quality(draft_id_param INTEGER)
RETURNS DECIMAL(4,3) AS $$
DECLARE
    total_paragraphs INTEGER;
    cited_paragraphs INTEGER;
    quality_score DECIMAL(4,3);
BEGIN
    SELECT COUNT(*) INTO total_paragraphs 
    FROM paragraph_citations 
    WHERE draft_id = draft_id_param;
    
    SELECT COUNT(*) INTO cited_paragraphs 
    FROM paragraph_citations 
    WHERE draft_id = draft_id_param 
    AND JSONB_ARRAY_LENGTH(citations) > 0;
    
    IF total_paragraphs = 0 THEN
        RETURN 0.0;
    END IF;
    
    quality_score := ROUND((cited_paragraphs::DECIMAL / total_paragraphs::DECIMAL), 3);
    RETURN quality_score;
END;
$$ LANGUAGE plpgsql;