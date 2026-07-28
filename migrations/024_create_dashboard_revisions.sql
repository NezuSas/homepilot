CREATE TABLE IF NOT EXISTS dashboard_revisions (
  id TEXT PRIMARY KEY,
  dashboard_id TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dashboard_revisions_dashboard_created
  ON dashboard_revisions(dashboard_id, created_at DESC);
