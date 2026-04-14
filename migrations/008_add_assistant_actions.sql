-- Migration 008: Assistant V2 Actions
-- Soporta acciones guiadas persistentes para cada hallazgo.

ALTER TABLE assistant_findings ADD COLUMN actions TEXT; -- JSON string array of AssistantAction
