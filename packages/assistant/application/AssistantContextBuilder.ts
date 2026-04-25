import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

import { AssistantMemoryPort } from './ports/AssistantMemoryPort';

/**
 * AssistantContextBuilder
 * 
 * Builds a privacy-aware context of the home setup for the LLM.
 * Limits the number of entities to avoid context window issues.
 */
export class AssistantContextBuilder implements AssistantContextBuilderPort {
  private readonly MAX_DEVICES = 50;
  private readonly MAX_SCENES = 50;
  private readonly MAX_RECENT_ACTIONS = 5;

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly memoryService?: AssistantMemoryPort
  ) {}

  /**
   * Generates a JSON string containing the minimal home setup context.
   * Excludes sensitive data like IPs, tokens, or internal states.
   */
  public async build(): Promise<string> {
    const [allDevices, allScenes] = await Promise.all([
      this.deviceRepository.findAll(),
      this.sceneRepository.findAll(),
    ]);

    const devices = allDevices.slice(0, this.MAX_DEVICES).map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      roomId: d.roomId,
      state: d.lastKnownState,
      capabilities: d.capabilities,
    }));

    const scenes = allScenes.slice(0, this.MAX_SCENES).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    let recentActions: { deviceId: string; commandName: string; status: string }[] = [];
    
    if (this.memoryService) {
      const records = await this.memoryService.getRecentActions(this.MAX_RECENT_ACTIONS);
      recentActions = records.flatMap(record => 
        record.actions.map(action => ({
          deviceId: action.deviceId,
          commandName: action.commandName,
          status: action.status
        }))
      ).slice(0, this.MAX_RECENT_ACTIONS);
    }

    return JSON.stringify({
      devices,
      scenes,
      recentActions
    });
  }
}
