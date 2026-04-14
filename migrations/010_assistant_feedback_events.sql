-- Assistant V4 Behavioral Learning Layer
CREATE TABLE assistant_feedback_events (
  id TEXT PRIMARY KEY,
  finding_type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  room_id TEXT,
  domain TEXT,
  action_type TEXT,
  feedback_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata TEXT
);

CREATE INDEX idx_feedback_type ON assistant_feedback_events(finding_type);
CREATE INDEX idx_feedback_room ON assistant_feedback_events(room_id);
