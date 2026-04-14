CREATE TABLE assistant_drafts (
    id TEXT PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL, -- Stabilize identity
    type TEXT NOT NULL, 
    status TEXT NOT NULL, 
    payload TEXT NOT NULL, 
    created_at TEXT NOT NULL
);
