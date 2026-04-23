-- Phase: Grant metrics tracking (application + outcome metrics)
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Extend projects with structured amount / reporting columns.
--    Existing `amount` text column is preserved for backwards compatibility.
ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS amount_requested INTEGER,
  ADD COLUMN IF NOT EXISTS amount_awarded INTEGER,
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reporting_due_at TIMESTAMPTZ;

-- 2. grant_metrics: per-project metric definitions + current values.
CREATE TABLE IF NOT EXISTS grant_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT,
  target TEXT,
  unit TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  source_document_id VARCHAR REFERENCES documents(id) ON DELETE SET NULL,
  source_chunk_id VARCHAR REFERENCES doc_chunks(id) ON DELETE SET NULL,
  confidence INTEGER,
  rationale TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grant_metrics_project_id
  ON grant_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_grant_metrics_status
  ON grant_metrics(project_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grant_metrics_project_key
  ON grant_metrics(project_id, key)
  WHERE status <> 'dismissed';

-- 3. grant_metric_events: append-only history of value changes.
CREATE TABLE IF NOT EXISTS grant_metric_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id VARCHAR NOT NULL REFERENCES grant_metrics(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by VARCHAR REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_grant_metric_events_metric_id
  ON grant_metric_events(metric_id, recorded_at DESC);

COMMIT;
