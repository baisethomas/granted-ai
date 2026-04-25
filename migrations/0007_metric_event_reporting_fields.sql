-- Add reporting-period and evidence metadata to metric update history.
BEGIN;

ALTER TABLE IF EXISTS grant_metric_events
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS source_document_id VARCHAR REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'recorded';

CREATE INDEX IF NOT EXISTS idx_grant_metric_events_period
  ON grant_metric_events(metric_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_grant_metric_events_status
  ON grant_metric_events(metric_id, status);

COMMIT;
