import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

/**
 * AssistantContextBuilder
 * 
 * Builds a privacy-aware context of the home setup for the LLM.
 * Limits the number of entities to avoid context window issues.
 */
export class AssistantContextBuilder implements AssistantContextBuilderPort {
  private readonly MAX_DEVICES = 50;
  private readonly MAX_SCENES = 50;

  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository
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
      capabilities: d.capabilities,
    }));

    const scenes = allScenes.slice(0, this.MAX_SCENES).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    return JSON.stringify({
      devices,
      scenes,
    });
  }
}
