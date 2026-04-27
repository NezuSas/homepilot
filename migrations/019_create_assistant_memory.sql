-- Migration 019: Assistant Memory & Context V2
-- Dedicated persistence for conversational context and user preferences.

CREATE TABLE IF NOT EXISTS assistant_memory (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'json', 'number'
    expires_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, key)
);

-- Index for expiring old memory entries
CREATE INDEX IF NOT EXISTS idx_assistant_memory_expires ON assistant_memory(expires_at);
