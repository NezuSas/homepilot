CREATE TABLE IF NOT EXISTS native_camera_sources (
  device_id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'onvif-ptz',
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  onvif_port INTEGER NOT NULL DEFAULT 8000,
  rtsp_port INTEGER NOT NULL DEFAULT 554,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  rtsp_path TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY(home_id) REFERENCES homes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_native_camera_sources_home
  ON native_camera_sources(home_id);
