import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { ExecutionRecord } from '../../devices/domain/ExecutionRecord';
import { AssistantMemoryPort, AssistantMemoryState } from './ports/AssistantMemoryPort';
import { AssistantMemoryRepository } from '../domain/repositories/AssistantMemoryRepository';

export class AssistantMemoryService implements AssistantMemoryPort {
  private readonly SHORT_TERM_MEMORY_KEY = 'short_term_context';
  private readonly SHORT_TERM_TTL_SECONDS = 3600; // 1 hour

  constructor(
    private readonly executionRecordRepository: ExecutionRecordRepository,
    private readonly assistantMemoryRepository: AssistantMemoryRepository
  ) {}

  /**
   * Retrieves the most recent actions specifically executed manually or by the assistant.
   * Filters out automated system executions to maintain accurate conversational context.
   */
  public async getRecentActions(limit: number): Promise<ExecutionRecord[]> {
    const recent = await this.executionRecordRepository.findRecent(limit * 3); // Fetch more to allow filtering
    
    return recent.filter(record => {
      return record.sourceType === 'manual' && (
        record.sourceId === 'assistant' ||
        record.sourceId.startsWith('retry:') ||
        record.correlationId?.startsWith('assistant:')
      );
    }).slice(0, limit);
  }

  /**
   * Retrieves the ID of the last device manipulated by the user/assistant.
   */
  public async getLastDeviceUsed(): Promise<string | null> {
    const recent = await this.getRecentActions(10);
    for (const record of recent) {
      if (record.actions && record.actions.length > 0) {
        // Find the first action that has a deviceId
        const deviceAction = record.actions.find(a => a.deviceId);
        if (deviceAction) {
          return deviceAction.deviceId;
        }
      }
    }
    return null;
  }

  /**
   * Retrieves the ID of the last scene executed by the user/assistant.
   */
  public async getLastSceneUsed(): Promise<string | null> {
    // TODO: Since we filter by sourceType === 'manual', normal scenes might not be caught
    // unless they are mapped as manual assistant actions. 
    // Returning null for V1 to be safe and avoid matching automations or random scenes.
    return null;
  }

  // V2 Conversational Memory
  
  public async saveShortTermMemory(userId: string, state: AssistantMemoryState): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.SHORT_TERM_TTL_SECONDS);

    await this.assistantMemoryRepository.upsert({
      userId,
      key: this.SHORT_TERM_MEMORY_KEY,
      value: JSON.stringify(state),
      valueType: 'json',
      expiresAt: expiresAt.toISOString()
    });
  }

  public async getShortTermMemory(userId: string): Promise<AssistantMemoryState | null> {
    const record = await this.assistantMemoryRepository.findByKey(userId, this.SHORT_TERM_MEMORY_KEY);
    if (!record) return null;

    try {
      return JSON.parse(record.value);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AssistantMemory] Failed to parse short term memory:', e);
      }
      return null;
    }
  }

  // V2 User Personalization

  public async getUserPreference(userId: string, key: string): Promise<string | null> {
    const record = await this.assistantMemoryRepository.findByKey(userId, `pref:${key}`);
    return record?.value ?? null;
  }

  public async setUserPreference(userId: string, key: string, value: string): Promise<void> {
    await this.assistantMemoryRepository.upsert({
      userId,
      key: `pref:${key}`,
      value,
      valueType: 'string',
      expiresAt: null
    });
  }

  // V2 Aliases

  public async getAlias(userId: string, alias: string): Promise<string | null> {
    const record = await this.assistantMemoryRepository.findByKey(userId, `alias:${alias}`);
    return record?.value ?? null;
  }

  public async getAliases(userId: string): Promise<Record<string, string>> {
    const records = await this.assistantMemoryRepository.listByPrefix(userId, 'alias:');
    return records.reduce((acc, record) => {
      const alias = record.key.replace('alias:', '');
      acc[alias] = record.value;
      return acc;
    }, {} as Record<string, string>);
  }

  public async setAlias(userId: string, alias: string, targetId: string): Promise<void> {
    await this.assistantMemoryRepository.upsert({
      userId,
      key: `alias:${alias}`,
      value: targetId,
      valueType: 'string',
      expiresAt: null
    });
  }
}
