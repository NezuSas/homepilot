-- Migration 014: System Variables
-- Persistent key-value store for global and per-home automation variables.
-- Supports typed values (string, number, boolean, json) and optional TTL.

CREATE TABLE IF NOT EXISTS system_variables (
  id          TEXT NOT NULL PRIMARY KEY,
  scope       TEXT NOT NULL CHECK(scope IN ('global', 'home')),
  home_id     TEXT,
  name        TEXT NOT NULL,
  value       TEXT NOT NULL,
  value_type  TEXT NOT NULL CHECK(value_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  ttl_seconds INTEGER,
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
  updated_at  TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')),
  -- Within a scope, name must be unique (home_id NULL for global scope)
  UNIQUE(scope, home_id, name)
);

CREATE INDEX IF NOT EXISTS idx_system_variables_scope_home
  ON system_variables(scope, home_id);

CREATE INDEX IF NOT EXISTS idx_system_variables_expires_at
  ON system_variables(expires_at)
  WHERE expires_at IS NOT NULL;
