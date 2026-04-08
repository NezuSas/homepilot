-- Up
CREATE TABLE IF NOT EXISTS system_setup (
    id TEXT PRIMARY KEY,
    is_initialized INTEGER NOT NULL DEFAULT 0,
    initialized_at TEXT,
    setup_version INTEGER NOT NULL DEFAULT 1,
    onboarding_completed_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(onboarding_completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Initialize the single rigorous row for the appliance
INSERT OR IGNORE INTO system_setup (
    id, is_initialized, setup_version, created_at, updated_at
) VALUES (
    'local-edge', 0, 1, datetime('now'), datetime('now')
);

-- Down
DROP TABLE IF EXISTS system_setup;
