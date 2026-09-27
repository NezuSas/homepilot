CREATE TABLE IF NOT EXISTS android_display_sources (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  adb_host TEXT NOT NULL,
  adb_port INTEGER NOT NULL CHECK (adb_port = 5555),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(adb_host, adb_port)
);

CREATE INDEX IF NOT EXISTS idx_android_display_sources_home
  ON android_display_sources(home_id);

CREATE TABLE IF NOT EXISTS android_display_observations (
  device_id TEXT PRIMARY KEY REFERENCES android_display_sources(device_id) ON DELETE CASCADE,
  adb_serial TEXT,
  android_id TEXT,
  manufacturer TEXT,
  model TEXT,
  android_version TEXT,
  resolution TEXT,
  density_dpi INTEGER,
  screen_state TEXT NOT NULL DEFAULT 'unknown',
  connection_state TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_android_display_observations_android_id
  ON android_display_observations(android_id) WHERE android_id IS NOT NULL;
