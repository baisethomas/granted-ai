-- Citation System Enhancement for Paragraph-Level Source Attribution
-- This migration extends the existing draft_citations table and adds comprehensive citation tracking

-- First, enhance the existing draft_citations table with more granular tracking
ALTER TABLE "draft_citations" ADD COLUMN "paragraph_id" text;
ALTER TABLE "draft_citations" ADD COLUMN "sentence_range" jsonb; -- {start: number, end: number}
ALTER TABLE "draft_citations" ADD COLUMN "confidence_score" decimal(3,2) DEFAULT 0.0;
ALTER TABLE "draft_citations" ADD COLUMN "citation_type" text DEFAULT 'direct'; -- 'direct', 'paraphrase', 'inference'
ALTER TABLE "draft_citations" ADD COLUMN "grounding_strength" text DEFAULT 'medium'; -- 'high', 'medium', 'low'
ALTER TABLE "draft_citations" ADD COLUMN "validation_status" text DEFAULT 'pending'; -- 'validated', 'flagged', 'pending'

-- Create detailed citation mappings table for paragraph-level tracking
CREATE TABLE IF NOT EXISTS "paragraph_citations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" varchar NOT NULL,
  "paragraph_id" varchar NOT NULL, -- UUID for each paragraph
  "paragraph_text" text NOT NULL,
  "paragraph_order" integer NOT NULL,
  "total_citations" integer DEFAULT 0,
  "grounding_quality" decimal(3,2) DEFAULT 0.0, -- 0.0 to 1.0 quality score
  "validation_issues" jsonb DEFAULT '[]', -- Array of validation issues
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create individual citation sources table for granular attribution
CREATE TABLE IF NOT EXISTS "citation_sources" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "paragraph_citation_id" varchar NOT NULL,
  "chunk_id" varchar NOT NULL, -- References doc_chunks.id
  "document_id" varchar NOT NULL, -- References documents.id
  "text_match" text NOT NULL, -- The specific text being cited
  "source_text" text NOT NULL, -- The original text from the chunk
  "similarity_score" decimal(4,3) NOT NULL, -- How similar the citation is to source
  "citation_strength" text NOT NULL, -- 'strong', 'moderate', 'weak'
  "position_in_paragraph" integer NOT NULL, -- Character position in paragraph
  "citation_method" text DEFAULT 'semantic', -- 'semantic', 'exact', 'paraphrase'
  "page_number" integer,
  "section_title" text,
  "created_at" timestamp DEFAULT now()
);

-- Create evidence map for visualization
CREATE TABLE IF NOT EXISTS "evidence_maps" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "draft_id" varchar NOT NULL,
  "question_id" varchar NOT NULL,
  "section_name" text NOT NULL,
  "evidence_strength" decimal(3,2) NOT NULL, -- Overall strength for this section
  "source_coverage" decimal(3,2) NOT NULL, -- Percentage of claims with sources
  "hallucination_risk" text NOT NULL, -- 'low', 'medium', 'high'
  "unsupported_claims" jsonb DEFAULT '[]', -- Array of flagged unsupported claims
  "source_distribution" jsonb NOT NULL, -- Document source distribution stats
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create citation validation logs for quality tracking
CREATE TABLE IF NOT EXISTS "citation_validations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "citation_source_id" varchar NOT NULL,
  "validation_type" text NOT NULL, -- 'automatic', 'manual', 'ai_review'
  "is_valid" boolean NOT NULL,
  "validation_score" decimal(3,2) NOT NULL,
  "issues_found" jsonb DEFAULT '[]', -- Array of specific issues
  "validator_notes" text,
  "validated_by" varchar, -- User ID if manual validation
  "created_at" timestamp DEFAULT now()
);

-- Create citation templates for different academic styles
CREATE TABLE IF NOT EXISTS "citation_formats" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "format_name" text NOT NULL, -- 'apa', 'mla', 'chicago', 'grant_standard'
  "inline_template" text NOT NULL, -- Template for inline citations
  "bibliography_template" text NOT NULL, -- Template for bibliography entries
  "footnote_template" text, -- Template for footnotes (if applicable)
  "is_default" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "paragraph_citations" ADD CONSTRAINT "paragraph_citations_draft_id_drafts_id_fk" 
FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE CASCADE;

ALTER TABLE "citation_sources" ADD CONSTRAINT "citation_sources_paragraph_citation_id_paragraph_citations_id_fk" 
FOREIGN KEY ("paragraph_citation_id") REFERENCES "public"."paragraph_citations"("id") ON DELETE CASCADE;

ALTER TABLE "citation_sources" ADD CONSTRAINT "citation_sources_chunk_id_doc_chunks_id_fk" 
FOREIGN KEY ("chunk_id") REFERENCES "public"."doc_chunks"("id") ON DELETE CASCADE;

ALTER TABLE "citation_sources" ADD CONSTRAINT "citation_sources_document_id_documents_id_fk" 
FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;

ALTER TABLE "evidence_maps" ADD CONSTRAINT "evidence_maps_draft_id_drafts_id_fk" 
FOREIGN KEY ("draft_id") REFERENCES "public"."drafts"("id") ON DELETE CASCADE;

ALTER TABLE "evidence_maps" ADD CONSTRAINT "evidence_maps_question_id_grant_questions_id_fk" 
FOREIGN KEY ("question_id") REFERENCES "public"."grant_questions"("id") ON DELETE CASCADE;

ALTER TABLE "citation_validations" ADD CONSTRAINT "citation_validations_citation_source_id_citation_sources_id_fk" 
FOREIGN KEY ("citation_source_id") REFERENCES "public"."citation_sources"("id") ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "paragraph_citations_draft_id_idx" 
ON "paragraph_citations" ("draft_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "paragraph_citations_grounding_quality_idx" 
ON "paragraph_citations" ("grounding_quality");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "citation_sources_paragraph_citation_id_idx" 
ON "citation_sources" ("paragraph_citation_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "citation_sources_chunk_id_idx" 
ON "citation_sources" ("chunk_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "citation_sources_similarity_score_idx" 
ON "citation_sources" ("similarity_score");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "evidence_maps_draft_id_idx" 
ON "evidence_maps" ("draft_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "citation_validations_citation_source_id_idx" 
ON "citation_validations" ("citation_source_id");

-- Insert default citation formats
INSERT INTO "citation_formats" ("format_name", "inline_template", "bibliography_template", "is_default") VALUES 
(
  'grant_standard',
  '({{document_name}}, {{page_number}})',
  '{{document_name}}. {{organization_name}}. {{year}}.',
  true
),
(
  'apa',
  '({{author}}, {{year}}, p. {{page_number}})',
  '{{author}} ({{year}}). {{document_name}}. {{organization_name}}.',
  false
),
(
  'academic_brief',
  '[{{document_short_name}}]',
  '{{document_short_name}}: {{document_name}}, {{organization_name}}.',
  false
);

-- Create functions for citation analysis

-- Function to calculate grounding quality for a paragraph
CREATE OR REPLACE FUNCTION calculate_paragraph_grounding_quality(paragraph_id varchar)
RETURNS decimal(3,2) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    CASE 
      WHEN COUNT(cs.id) = 0 THEN 0.0
      ELSE ROUND(AVG(cs.similarity_score)::decimal(3,2), 2)
    END,
    0.0
  )
  FROM paragraph_citations pc
  LEFT JOIN citation_sources cs ON cs.paragraph_citation_id = pc.id
  WHERE pc.paragraph_id = calculate_paragraph_grounding_quality.paragraph_id;
$$;

-- Function to get citation statistics for a draft
CREATE OR REPLACE FUNCTION get_draft_citation_stats(draft_id varchar)
RETURNS TABLE (
  total_paragraphs bigint,
  cited_paragraphs bigint,
  citation_coverage decimal(3,2),
  avg_grounding_quality decimal(3,2),
  total_sources bigint,
  unique_documents bigint
) LANGUAGE sql STABLE AS $$
  SELECT 
    COUNT(pc.id) as total_paragraphs,
    COUNT(CASE WHEN pc.total_citations > 0 THEN 1 END) as cited_paragraphs,
    ROUND(
      (COUNT(CASE WHEN pc.total_citations > 0 THEN 1 END)::decimal / 
       NULLIF(COUNT(pc.id), 0) * 100), 2
    ) as citation_coverage,
    ROUND(AVG(pc.grounding_quality), 2) as avg_grounding_quality,
    COALESCE(SUM(pc.total_citations), 0) as total_sources,
    COUNT(DISTINCT cs.document_id) as unique_documents
  FROM paragraph_citations pc
  LEFT JOIN citation_sources cs ON cs.paragraph_citation_id = pc.id
  WHERE pc.draft_id = get_draft_citation_stats.draft_id;
$$;

-- Function to identify unsupported claims (paragraphs with low grounding)
CREATE OR REPLACE FUNCTION identify_unsupported_claims(
  draft_id varchar,
  min_grounding_threshold decimal(3,2) DEFAULT 0.6
)
RETURNS TABLE (
  paragraph_id varchar,
  paragraph_text text,
  grounding_quality decimal(3,2),
  issue_severity text
) LANGUAGE sql STABLE AS $$
  SELECT 
    pc.paragraph_id,
    pc.paragraph_text,
    pc.grounding_quality,
    CASE 
      WHEN pc.grounding_quality < 0.3 THEN 'high'
      WHEN pc.grounding_quality < min_grounding_threshold THEN 'medium'
      ELSE 'low'
    END as issue_severity
  FROM paragraph_citations pc
  WHERE pc.draft_id = identify_unsupported_claims.draft_id
    AND pc.grounding_quality < min_grounding_threshold
  ORDER BY pc.grounding_quality ASC, pc.paragraph_order ASC;
$$;

-- Function to get source distribution for evidence mapping
CREATE OR REPLACE FUNCTION get_source_distribution(draft_id varchar)
RETURNS TABLE (
  document_id varchar,
  document_name text,
  citation_count bigint,
  avg_similarity decimal(3,2),
  coverage_percentage decimal(3,2)
) LANGUAGE sql STABLE AS $$
  WITH draft_totals AS (
    SELECT COUNT(*) as total_citations
    FROM paragraph_citations pc
    JOIN citation_sources cs ON cs.paragraph_citation_id = pc.id
    WHERE pc.draft_id = get_source_distribution.draft_id
  )
  SELECT 
    cs.document_id,
    d.original_name as document_name,
    COUNT(cs.id) as citation_count,
    ROUND(AVG(cs.similarity_score)::decimal(3,2), 2) as avg_similarity,
    ROUND((COUNT(cs.id)::decimal / dt.total_citations * 100), 2) as coverage_percentage
  FROM citation_sources cs
  JOIN paragraph_citations pc ON pc.id = cs.paragraph_citation_id
  JOIN documents d ON d.id = cs.document_id
  CROSS JOIN draft_totals dt
  WHERE pc.draft_id = get_source_distribution.draft_id
  GROUP BY cs.document_id, d.original_name, dt.total_citations
  ORDER BY citation_count DESC;
$$;

-- Add comments for documentation
COMMENT ON TABLE "paragraph_citations" IS 'Tracks citation information at the paragraph level for grounding quality analysis';
COMMENT ON TABLE "citation_sources" IS 'Individual citation sources with detailed attribution and similarity metrics';
COMMENT ON TABLE "evidence_maps" IS 'Visual evidence mapping for draft sections showing grounding strength and coverage';
COMMENT ON TABLE "citation_validations" IS 'Validation logs for citation accuracy and quality control';
COMMENT ON TABLE "citation_formats" IS 'Templates for different citation styles (APA, MLA, grant-specific, etc.)';

COMMENT ON COLUMN "paragraph_citations"."grounding_quality" IS 'Quality score (0-1) indicating how well the paragraph is supported by sources';
COMMENT ON COLUMN "citation_sources"."similarity_score" IS 'Semantic similarity between cited text and source (0-1)';
COMMENT ON COLUMN "citation_sources"."citation_strength" IS 'Qualitative assessment of citation strength based on similarity and relevance';
COMMENT ON COLUMN "evidence_maps"."source_coverage" IS 'Percentage of claims in the section that have supporting citations';
COMMENT ON COLUMN "evidence_maps"."hallucination_risk" IS 'AI assessment of potential unsupported or fabricated claims';