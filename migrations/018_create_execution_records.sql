-- migration: 018_create_execution_records.sql

CREATE TABLE IF NOT EXISTS execution_records (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL, -- 'scene', 'automation', 'manual'
    source_id TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    action_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    correlation_id TEXT,
    summary TEXT,
    actions_json TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_execution_records_source ON execution_records (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_execution_records_started_at ON execution_records (started_at);
