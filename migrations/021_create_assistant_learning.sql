CREATE TABLE IF NOT EXISTS assistant_learning_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_name TEXT,
  room_id TEXT,
  prompt TEXT,
  correction TEXT,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_learning_user_event ON assistant_learning_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_assistant_learning_entity ON assistant_learning_events(entity_id);
