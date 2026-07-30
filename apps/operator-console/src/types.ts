/**
 * Union de vistas posibles para tipado estricto.
 */
export type View =
  // Primary
  | 'dashboard'
  | 'spaces'
  | 'routines'
  // Backward-compatible routine section aliases.
  | 'scenes'
  | 'automations'
  | 'assistant'
  | 'resilience-showcase'
  | 'home-conversation'
  // Personalization (placeholders)
  | 'dashboards'
  | 'energy'
  // System
  | 'system-devices'
  | 'system-inbox'
  | 'system-diagnostics'
  | 'system-audit'
  | 'system-executions'
  | 'system-users'
  | 'system-ha'
  | 'system-cameras'
  | 'system-onboarding'
  // Legacy aliases resolved at runtime (not stored in state)
  | 'topology'
  | 'inbox'
  | 'audit-logs'
  | 'ha-settings'
  | 'diagnostics'
  | 'users';
