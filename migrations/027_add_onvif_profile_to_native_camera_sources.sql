-- Migration 027: ONVIF profile negotiation metadata for native camera sources
--
-- Phase 2 of the native camera hexagonal refactor replaces the ad hoc ONVIF
-- negotiation (node-onvif's getUdpStreamUrl()) with real GetProfiles/GetStreamUri
-- SOAP calls, and persists the chosen profile so re-negotiation is stable across
-- restarts. All columns are nullable/defaulted so existing rows remain valid
-- immediately with no backfill: profile_token/ptz_configuration_token are NULL
-- and ptz_supported is 0 ("behaves exactly as today") until the operator saves
-- or re-negotiates the camera.

ALTER TABLE native_camera_sources ADD COLUMN profile_token TEXT;
ALTER TABLE native_camera_sources ADD COLUMN ptz_configuration_token TEXT;
ALTER TABLE native_camera_sources ADD COLUMN ptz_supported INTEGER NOT NULL DEFAULT 0;
