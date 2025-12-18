-- Consolidated Schema Migration for Production Architecture
-- This migration consolidates all agent systems into a unified Next.js 15 architecture

-- Add performance indexes for all agent systems
CREATE INDEX CONCURRENTLY IF NOT EXISTS "documents_organization_id_processed_idx" 
ON "documents" ("organization_id", "processed");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "doc_chunks_document_id_embedding_idx" 
ON "doc_chunks" ("document_id") WHERE "embedding" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "usage_events_organization_created_idx" 
ON "usage_events" ("organization_id", "created_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "clarification_sessions_project_status_idx" 
ON "clarification_sessions" ("project_id", "status");

-- Add audit trail columns for production monitoring
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_accessed_at" timestamp;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "generation_count" integer DEFAULT 0;

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "access_count" integer DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp;

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "features_enabled" jsonb DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "api_quota_used" integer DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "api_quota_reset" timestamp DEFAULT NOW();

-- Add production configuration tables
CREATE TABLE IF NOT EXISTS "system_config" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_at" timestamp DEFAULT NOW()
);

-- Insert default system configuration
INSERT INTO "system_config" ("key", "value", "description") VALUES
('rag_pipeline', '{"enabled": true, "embedding_model": "text-embedding-3-small", "chunk_size": 1000}', 'RAG pipeline configuration'),
('citation_system', '{"enabled": true, "min_grounding_quality": 0.6, "citation_coverage_threshold": 0.8}', 'Citation system configuration'),
('clarification_engine', '{"enabled": true, "max_questions": 5, "assumption_threshold": 0.7}', 'Clarification engine configuration'),
('billing_system', '{"enabled": true, "token_tracking": true, "cost_alerts": true}', 'Billing and usage tracking configuration')
ON CONFLICT (key) DO NOTHING;

-- Add production monitoring views
CREATE OR REPLACE VIEW "organization_health" AS
SELECT 
  o.id,
  o.name,
  o.plan,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT d.id) as total_documents,
  COUNT(DISTINCT CASE WHEN d.processed = true THEN d.id END) as processed_documents,
  COALESCE(SUM(ue.cost), 0) as total_cost_cents,
  COALESCE(SUM(ue.tokens_in + ue.tokens_out), 0) as total_tokens,
  MAX(p.created_at) as last_project_created,
  MAX(d.uploaded_at) as last_document_uploaded
FROM organizations o
LEFT JOIN projects p ON o.id = p.organization_id
LEFT JOIN documents d ON o.id = d.organization_id
LEFT JOIN usage_events ue ON o.id = ue.organization_id
GROUP BY o.id, o.name, o.plan;

CREATE OR REPLACE VIEW "system_usage_summary" AS
SELECT 
  DATE_TRUNC('day', created_at) as usage_date,
  COUNT(*) as total_events,
  COUNT(DISTINCT organization_id) as active_organizations,
  SUM(tokens_in + tokens_out) as total_tokens,
  SUM(cost) as total_cost_cents,
  AVG(cost) as avg_cost_per_event
FROM usage_events 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY usage_date DESC;

-- Add system health check functions
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE (
  component text,
  status text,
  details jsonb
) LANGUAGE sql STABLE AS $$
  -- Check database connections
  SELECT 'database' as component, 'healthy' as status, 
    jsonb_build_object('connections', 1) as details
  UNION ALL
  
  -- Check recent activity
  SELECT 'user_activity' as component,
    CASE 
      WHEN COUNT(*) > 0 THEN 'healthy'
      ELSE 'warning'
    END as status,
    jsonb_build_object(
      'recent_logins', COUNT(*),
      'last_24h', COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END)
    ) as details
  FROM usage_events WHERE created_at > NOW() - INTERVAL '7 days'
  
  UNION ALL
  
  -- Check system configuration
  SELECT 'configuration' as component, 'healthy' as status,
    jsonb_build_object(
      'config_count', COUNT(*),
      'last_updated', MAX(updated_at)
    ) as details
  FROM system_config;
$$;

-- Add function to get organization feature usage
CREATE OR REPLACE FUNCTION get_organization_features(org_id varchar)
RETURNS TABLE (
  feature text,
  enabled boolean,
  usage_count bigint,
  last_used timestamp
) LANGUAGE sql STABLE AS $$
  SELECT 
    'rag_pipeline' as feature,
    true as enabled,
    COUNT(CASE WHEN type = 'rag_search' THEN 1 END) as usage_count,
    MAX(CASE WHEN type = 'rag_search' THEN created_at END) as last_used
  FROM usage_events WHERE organization_id = org_id
  
  UNION ALL
  
  SELECT 
    'citation_system' as feature,
    true as enabled,
    COUNT(CASE WHEN type = 'citation_generation' THEN 1 END) as usage_count,
    MAX(CASE WHEN type = 'citation_generation' THEN created_at END) as last_used
  FROM usage_events WHERE organization_id = org_id
  
  UNION ALL
  
  SELECT 
    'clarification_engine' as feature,
    true as enabled,
    COUNT(*) as usage_count,
    MAX(created_at) as last_used
  FROM clarification_sessions WHERE organization_id = org_id
  
  UNION ALL
  
  SELECT 
    'ai_generation' as feature,
    true as enabled,
    COUNT(CASE WHEN type IN ('generation', 'summarization') THEN 1 END) as usage_count,
    MAX(CASE WHEN type IN ('generation', 'summarization') THEN created_at END) as last_used
  FROM usage_events WHERE organization_id = org_id;
$$;

-- Add constraints for data integrity
ALTER TABLE "projects" ADD CONSTRAINT "projects_deadline_future" 
CHECK (deadline IS NULL OR deadline > created_at);

ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_cost_non_negative" 
CHECK (cost IS NULL OR cost >= 0);

ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tokens_non_negative" 
CHECK ((tokens_in IS NULL OR tokens_in >= 0) AND (tokens_out IS NULL OR tokens_out >= 0));

-- Add comments for documentation
COMMENT ON VIEW "organization_health" IS 'Comprehensive health metrics for each organization';
COMMENT ON VIEW "system_usage_summary" IS 'Daily aggregated usage statistics for system monitoring';
COMMENT ON FUNCTION "check_system_health" IS 'Returns overall system health status for monitoring';
COMMENT ON FUNCTION "get_organization_features" IS 'Returns feature usage statistics for a specific organization';

-- Update schema version
INSERT INTO system_config (key, value, description) VALUES 
('schema_version', '"0004_consolidation"', 'Current database schema version')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();