CREATE TABLE directory_account_links (
  directory_account_id TEXT PRIMARY KEY,
  local_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX idx_directory_account_links_local_user_id ON directory_account_links(local_user_id);
CREATE TABLE directory_sso_used_tokens (
  jti TEXT PRIMARY KEY,
  used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_directory_sso_used_tokens_expires_at ON directory_sso_used_tokens(expires_at);