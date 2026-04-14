import { createHash } from 'crypto';

export type FindingSeverity = 'high' | 'medium' | 'low';
export type FindingStatus = 'open' | 'dismissed' | 'resolved';

export type FindingType = 
  | 'new_device_available'
  | 'device_missing_room' 
  | 'device_name_technical'
  | 'device_name_duplicate'
  | 'automation_suggestion'
  | 'scene_suggestion'
  | 'optimization_suggestion';

export interface AssistantAction {
  type: string;
  label: string;
  payload?: any;
}

export interface AssistantFinding {
  id: string;
  fingerprint: string;
  source: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  status: FindingStatus;
  actions: AssistantAction[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  dismissedAt?: string | null;
  resolvedAt?: string | null;
}

/**
 * Utility to generate a stable fingerprint for a finding.
 */
export function generateFindingFingerprint(type: string, entityId: string | null, context: string = ''): string {
  const input = `${type}:${entityId || 'none'}:${context}`;
  return createHash('sha256').update(input).digest('hex');
}
