CREATE TABLE IF NOT EXISTS edge_device_identity_binding (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  binding_state TEXT NOT NULL CHECK (binding_state = 'bound'),
  home_id TEXT NOT NULL,
  edge_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  algorithm TEXT NOT NULL CHECK (algorithm = 'ES256'),
  bound_at TEXT NOT NULL
);
