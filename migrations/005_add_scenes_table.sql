CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    room_id TEXT,
    name TEXT NOT NULL,
    actions TEXT NOT NULL, -- JSON array of { deviceId, command }
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(home_id) REFERENCES homes(id),
    FOREIGN KEY(room_id) REFERENCES rooms(id)
);
