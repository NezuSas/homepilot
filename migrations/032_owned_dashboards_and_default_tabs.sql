-- Historical duplicate owners remain untouched and can be inspected here.
CREATE VIEW IF NOT EXISTS dashboard_owner_conflicts AS
SELECT owner_id, COUNT(*) AS dashboard_count
FROM dashboards
GROUP BY owner_id
HAVING COUNT(*) > 1;

CREATE TRIGGER IF NOT EXISTS dashboards_one_owner_insert
BEFORE INSERT ON dashboards
WHEN EXISTS (SELECT 1 FROM dashboards WHERE owner_id = NEW.owner_id AND id <> NEW.id)
BEGIN
  SELECT RAISE(ABORT, 'DASHBOARD_OWNER_EXISTS');
END;

CREATE TRIGGER IF NOT EXISTS dashboards_one_owner_update
BEFORE UPDATE OF owner_id ON dashboards
WHEN NEW.owner_id <> OLD.owner_id
  AND EXISTS (SELECT 1 FROM dashboards WHERE owner_id = NEW.owner_id AND id <> OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'DASHBOARD_OWNER_EXISTS');
END;

CREATE TRIGGER IF NOT EXISTS dashboards_one_default_insert
BEFORE INSERT ON dashboards
WHEN (SELECT COUNT(*) FROM json_each(NEW.tabs)
      WHERE json_extract(value, '$.isDefault') = 1) > 1
BEGIN
  SELECT RAISE(ABORT, 'DASHBOARD_MULTIPLE_DEFAULT_TABS');
END;

CREATE TRIGGER IF NOT EXISTS dashboards_one_default_update
BEFORE UPDATE OF tabs ON dashboards
WHEN (SELECT COUNT(*) FROM json_each(NEW.tabs)
      WHERE json_extract(value, '$.isDefault') = 1) > 1
BEGIN
  SELECT RAISE(ABORT, 'DASHBOARD_MULTIPLE_DEFAULT_TABS');
END;

-- Backfill only users without an owned dashboard; never alter existing cards.
INSERT INTO dashboards (id, owner_id, title, visibility, tabs, created_at, updated_at)
SELECT lower(hex(randomblob(16))), users.id,
  COALESCE(NULLIF(trim(users.display_name), ''), users.username),
  json_object('roles', json_array(), 'users', json_array(users.id), 'homes', json_array()),
  json_array(json_object('id', lower(hex(randomblob(16))), 'title', 'Principal', 'widgets', json_array())),
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users
WHERE NOT EXISTS (SELECT 1 FROM dashboards WHERE owner_id = users.id);

-- This insert runs inside the same SQLite transaction as user creation.
CREATE TRIGGER IF NOT EXISTS users_provision_owned_dashboard
AFTER INSERT ON users
BEGIN
  INSERT INTO dashboards (id, owner_id, title, visibility, tabs, created_at, updated_at)
  VALUES (
    lower(hex(randomblob(16))), NEW.id,
    COALESCE(NULLIF(trim(NEW.display_name), ''), NEW.username),
    json_object('roles', json_array(), 'users', json_array(NEW.id), 'homes', json_array()),
    json_array(json_object('id', lower(hex(randomblob(16))), 'title', 'Principal', 'widgets', json_array())),
    NEW.created_at, NEW.created_at
  );
END;
