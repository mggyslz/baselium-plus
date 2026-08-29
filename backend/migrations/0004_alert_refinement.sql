-- Phase 6 behavioral-intelligence refinement metadata.
ALTER TABLE users ADD COLUMN IF NOT EXISTS baseline_reset_at TIMESTAMPTZ;

ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS trend_direction VARCHAR(12) NOT NULL DEFAULT 'stable'
    CHECK (trend_direction IN ('worsening', 'stable', 'improving')),
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(20)
    CHECK (review_status IN ('reviewed', 'false_positive')),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES caregivers(caregiver_id);

CREATE INDEX IF NOT EXISTS idx_anomalies_open_triage
  ON anomalies (user_id, severity) WHERE is_resolved = FALSE;
