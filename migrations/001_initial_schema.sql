-- HomePilot V1 Initial Schema (SQLite)
-- Alineado con dominio Zero-Trust y requerimientos de miniPC local

-- 1. Topology: Homes
CREATE TABLE IF NOT EXISTS homes (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL, -- Zero-Trust owner mapping
    name TEXT NOT NULL,
    entity_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
);

-- 2. Topology: Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    name TEXT NOT NULL,
    entity_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

-- 3. Device Inventory & State (Core)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    room_id TEXT, -- Null if in Inbox
    external_id TEXT NOT NULL, -- ID provisto por discovery (e.g., Shelly ID)
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    vendor TEXT NOT NULL,
    status TEXT NOT NULL,
    last_known_state TEXT, -- JSON Object
    entity_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    -- Restricción crítica para evitar duplicidad por discovery
    UNIQUE(home_id, external_id)
);

-- 4. Automation: Rules Lifecycle
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    home_id TEXT NOT NULL,
    user_id TEXT NOT NULL, -- Owner context
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1, -- 1=True, 0=False
    trigger TEXT NOT NULL, -- JSON Configuration
    action TEXT NOT NULL,  -- JSON Configuration
    created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    FOREIGN KEY (home_id) REFERENCES homes(id) ON DELETE CASCADE
);

-- 5. Activity Logs (Append-only)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    data TEXT, -- Raw JSON payload for audits
    timestamp DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW')),
    correlation_id TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Se eliminan los triggers automáticos de updated_at para evitar "magia implícita".
-- Los adaptadores de infraestructura/repositorio serán responsables de actualizar 
-- las fechas antes de persistir, manteniendo el control explícito del flujo.
