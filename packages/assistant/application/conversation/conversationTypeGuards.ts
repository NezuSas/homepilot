import type { Intent } from '../ports/IntentInterpreterPort';
import type { PendingSuggestion } from './conversationTypes';

// Runtime type guards for values read from conversation memory and interpreters.

export function isPendingSuggestion(value: unknown): value is PendingSuggestion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.type === 'string';
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function isIntent(value: unknown): value is Intent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validTypes = ['scene', 'command', 'multi_command', 'explain', 'retry', 'company_info', 'unknown'];
  return typeof v.type === 'string' && validTypes.includes(v.type) && typeof v.prompt === 'string';
}

export function isClarificationKind(value: unknown): value is 'device' | 'scene' | 'alias_target' | 'room' {
  return value === 'device' || value === 'scene' || value === 'alias_target' || value === 'room';
}
