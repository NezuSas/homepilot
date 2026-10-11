-- Additive household access: existing users keep access to the whole home and never expire.
-- Rolling back the code leaves these columns and this table unused, without data loss.
ALTER TABLE users ADD COLUMN access_scope TEXT NOT NULL DEFAULT 'all' CHECK(access_scope IN ('all', 'rooms'));
ALTER TABLE users ADD COLUMN expires_at TEXT;

CREATE TABLE user_room_access (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, room_id)
);
CREATE INDEX user_room_access_room ON user_room_access(room_id);
