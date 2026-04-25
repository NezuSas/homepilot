import { ExecutionRecord } from '../../../devices/domain/ExecutionRecord';

export interface AssistantMemoryPort {
  getRecentActions(limit: number): Promise<ExecutionRecord[]>;
  getLastDeviceUsed(): Promise<string | null>;
  getLastSceneUsed(): Promise<string | null>;
}
