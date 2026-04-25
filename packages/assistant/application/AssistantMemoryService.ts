import { ExecutionRecordRepository } from '../../devices/domain/repositories/ExecutionRecordRepository';
import { ExecutionRecord } from '../../devices/domain/ExecutionRecord';
import { AssistantMemoryPort } from './ports/AssistantMemoryPort';

export class AssistantMemoryService implements AssistantMemoryPort {
  constructor(
    private readonly executionRecordRepository: ExecutionRecordRepository
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
}
