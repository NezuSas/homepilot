import { ExecutionRecord } from '../../../devices/domain/ExecutionRecord';
import { Intent } from '../ports/IntentInterpreterPort';

export interface AssistantClarificationOption {
  id: string;
  label: string;
  kind: 'device' | 'scene' | 'alias_target';
}

export interface AssistantMemoryEntity {
  id: string;
  name: string;
  type: string;
  roomId: string | null;
  /** Resolved display name for the room. Cached so follow-ups don't need a DB round-trip. */
  roomName?: string;
}

export interface AssistantMemoryState {
  lastQueryType: string;
  entities: AssistantMemoryEntity[];
  timestamp: string;
  
  /** Action waiting for user confirmation (yes/no) */
  pendingIntent?: Intent & { timestamp: string };
  
  /** Options presented to user for clarification */
  clarificationOptions?: AssistantClarificationOption[];
  
  /** Original prompt that led to clarification/confirmation */
  originalPrompt?: string;

  /** Reference to a draft created during conversation */
  pendingDraft?: {
    id: string;
    type: 'scene' | 'automation';
    originalPrompt: string;
  };

  /** Management action waiting for confirmation (rename, toggle, etc) */
  pendingManagementAction?: {
    type: 'rename_scene' | 'rename_automation' | 'toggle_automation' | 'edit_scene';
    targetId: string;
    targetName: string;
    payload: Record<string, unknown>;
    timestamp: string;
  };
}

export interface AssistantMemoryPort {
  getRecentActions(limit: number): Promise<ExecutionRecord[]>;
  getLastDeviceUsed(): Promise<string | null>;
  getLastSceneUsed(): Promise<string | null>;

  // V2 Conversational Memory
  saveShortTermMemory(userId: string, state: AssistantMemoryState): Promise<void>;
  getShortTermMemory(userId: string): Promise<AssistantMemoryState | null>;

  // V2 User Personalization
  getUserPreference(userId: string, key: string): Promise<string | null>;
  setUserPreference(userId: string, key: string, value: string): Promise<void>;

  // V2 Aliases
  getAlias(userId: string, alias: string): Promise<string | null>;
  getAliases(userId: string): Promise<Record<string, string>>;
  setAlias(userId: string, alias: string, targetId: string): Promise<void>;
}
