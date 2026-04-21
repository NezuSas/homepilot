-- Migration 017: Multi-Role System Expansion
-- Documenting the expanded roles in the users table.
-- No explicit schema alterations needed since `role` is currently a TEXT column without a strict ENUM constraint in SQLite.
-- This migration serves as architectural documentation.
--
-- Valid roles are now:
--  'admin'    : Technical superuser. Full access to everything including system config.
--  'operator' : Legacy / technical support role (behaves identical to admin).
--  'parent'   : Home owner. Manages devices, automations, scenes, energy. No system config.
--  'child'    : Family member. Controls devices and dashboards. No config or advanced views.
--  'guest'    : Temporary visitor. Basic device control only.
--
-- Enforcement is handled at the application layer by:
--  - UserRole type in domain/User.ts
--  - AuthGuard hierarchical weight evaluation
--  - UserManagementService static validity validation

SELECT 1;
