-- Migration 016: Add user profile fields (displayName, avatarDataUri)
-- These fields are optional and nullable; existing rows get NULL by default.

ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar_data_uri TEXT;
