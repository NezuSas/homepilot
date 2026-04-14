-- Migration 007: HomePilot Assistant V1
-- Persistencia para hallazgos y sugerencias proactivas del sistema.

CREATE TABLE IF NOT EXISTS assistant_findings (
    id TEXT PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL, -- type + entityId + context hash
    source TEXT NOT NULL,             -- 'system_scan', 'event_driven'
    type TEXT NOT NULL,               -- 'new_device_available', 'device_missing_room', etc.
    severity TEXT NOT NULL,           -- 'high', 'medium', 'low'
    title TEXT,                       -- Presentation fallback
    description TEXT,                -- Presentation fallback
    related_entity_type TEXT,        -- 'device', 'room', etc.
    related_entity_id TEXT,          -- ID de la entidad afectada
    status TEXT DEFAULT 'open',      -- 'open', 'dismissed', 'resolved'
    metadata TEXT,                    -- JSON payload con contexto para la regla
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    dismissed_at DATETIME,
    resolved_at DATETIME
);

-- Índices para búsqueda rápida en el dashboard y filtrado de badges
CREATE INDEX IF NOT EXISTS idx_findings_status ON assistant_findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_type ON assistant_findings(type);
CREATE INDEX IF NOT EXISTS idx_findings_entity ON assistant_findings(related_entity_id);
