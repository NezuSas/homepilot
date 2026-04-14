-- Migración 006: Soporte para inversión de estado en dispositivos
-- Permite corregir integraciones que reportan lógica invertida (ej: Abierto vs Cerrado)

ALTER TABLE devices ADD COLUMN invert_state INTEGER DEFAULT 0;
