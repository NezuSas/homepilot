-- Home Assistant publishes every state_changed event of the whole installation, and each one is looked up
-- by external_id alone. The only index on devices is UNIQUE(home_id, external_id), whose leading column is
-- home_id, so it cannot serve that query: EXPLAIN QUERY PLAN reports SCAN devices. With 20-30 events a
-- second on the single thread that also serves HTTP and the console WebSocket, that scan is pure overhead.
CREATE INDEX IF NOT EXISTS idx_devices_external_id ON devices(external_id);
