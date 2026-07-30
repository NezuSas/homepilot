CREATE TABLE IF NOT EXISTS tuya_settings (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  updated_at TEXT NOT NULL
);