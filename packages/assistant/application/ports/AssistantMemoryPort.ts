import { ExecutionRecord } from '../../../devices/domain/ExecutionRecord';

export interface AssistantMemoryState {
  lastQueryType: string;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    roomId: string | null;
  }>;
  timestamp: string;
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
