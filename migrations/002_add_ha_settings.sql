-- HomePilot V1: Home Assistant Settings
-- Persistencia de configuración local administrable

CREATE TABLE IF NOT EXISTS ha_settings (
    id TEXT PRIMARY KEY DEFAULT 'default', -- Singleton por ahora
    base_url TEXT NOT NULL,
    access_token TEXT NOT NULL,
    updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%f', 'NOW'))
);

-- Nota: Solo permitiremos una fila 'default' para V1.
-- El repositorio se encargará de gestionar el UPSERT.
