-- Migration 025: Assistant Confirmation Tickets
-- Dedicated, single-use, TTL-bound persistence for bulk/multi-device assistant
-- confirmations. Replaces the shared assistant_memory.pendingBulkAction blob so
-- that: the TTL is enforced consistently at the storage layer (not duplicated
-- as a magic number in application code), a confirmation can never be consumed
-- twice, and writing a new pending confirmation can never clobber unrelated
-- pending state (aliases, drafts, management actions) sharing the same row.

CREATE TABLE IF NOT EXISTS assistant_confirmation_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    home_id TEXT NOT NULL,
    command TEXT NOT NULL,
    bulk_type TEXT,
    device_ids_json TEXT NOT NULL,
    original_prompt TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME
);

-- Lookup path: "does this user have an active confirmation?"
CREATE INDEX IF NOT EXISTS idx_assistant_confirmation_tickets_user ON assistant_confirmation_tickets(user_id);
