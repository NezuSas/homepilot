CREATE TABLE assistant_drafts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'automation' | 'scene'
    status TEXT NOT NULL, -- 'draft' | 'active'
    payload TEXT NOT NULL, -- JSON
    created_at TEXT NOT NULL
);
