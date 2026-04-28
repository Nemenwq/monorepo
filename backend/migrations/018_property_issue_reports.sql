-- Property issue reports (from property detail report dialog)

CREATE TABLE IF NOT EXISTS property_issue_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id TEXT NOT NULL,
  category TEXT NOT NULL,
  details TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS property_issue_reports_property_id_idx
  ON property_issue_reports (property_id);

CREATE INDEX IF NOT EXISTS property_issue_reports_created_at_idx
  ON property_issue_reports (created_at DESC);

