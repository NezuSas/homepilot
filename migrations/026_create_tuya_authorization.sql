CREATE TABLE IF NOT EXISTS tuya_authorization (
  id TEXT PRIMARY KEY,
  user_code TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  uid TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);