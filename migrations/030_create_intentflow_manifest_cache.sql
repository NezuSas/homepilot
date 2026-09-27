CREATE TABLE IF NOT EXISTS intentflow_manifest_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  installation_id TEXT NOT NULL,
  last_success_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intentflow_board_manifests (
  board_id INTEGER PRIMARY KEY,
  installation_id TEXT NOT NULL,
  homepilot_device_id TEXT NOT NULL UNIQUE,
  revision TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intentflow_board_manifests_installation
  ON intentflow_board_manifests(installation_id);
