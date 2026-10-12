-- Additive: the activity log had no index besides its primary key, so every history, diagnostics and
-- retention query scanned the whole table. Data is not modified; rolling back the code leaves them unused.
CREATE INDEX IF NOT EXISTS activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS activity_logs_device_time ON activity_logs(device_id, timestamp);
CREATE INDEX IF NOT EXISTS activity_logs_type_time ON activity_logs(type, timestamp);
