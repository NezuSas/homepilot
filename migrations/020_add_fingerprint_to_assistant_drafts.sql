-- Migration: Add fingerprint column to assistant_drafts idempotently
-- This migration recreates the table to safely add 'fingerprint' without breaking
-- existing databases or crashing if the column already exists.

-- 1. Create a temporary table with the guaranteed existing schema
CREATE TABLE IF NOT EXISTS _assistant_drafts_tmp (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, 
    status TEXT NOT NULL, 
    payload TEXT NOT NULL, 
    created_at TEXT NOT NULL
);

-- 2. Copy data from the current table using only the known columns
-- This works whether the original table has 'fingerprint' or not.
INSERT OR IGNORE INTO _assistant_drafts_tmp (id, type, status, payload, created_at)
SELECT id, type, status, payload, created_at FROM assistant_drafts;

-- 3. Drop the old table
DROP TABLE assistant_drafts;

-- 4. Recreate the table with the proper schema including fingerprint
CREATE TABLE assistant_drafts (
    id TEXT PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, 
    status TEXT NOT NULL, 
    payload TEXT NOT NULL, 
    created_at TEXT NOT NULL
);

-- 5. Restore data, falling back to 'id' for the fingerprint
INSERT INTO assistant_drafts (id, fingerprint, type, status, payload, created_at)
SELECT 
    id,
    id, -- Use id as fallback fingerprint to satisfy UNIQUE NOT NULL
    type,
    status,
    payload,
    created_at
FROM _assistant_drafts_tmp;

-- 6. Cleanup temporary table
DROP TABLE _assistant_drafts_tmp;
