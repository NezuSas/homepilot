import { Intent } from './IntentInterpreterService';
import { AssistantPreviewResult } from '../domain/AssistantPreviewResult';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';

export class AssistantConfirmationPolicy {
  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly deviceRepository: DeviceRepository
  ) {}

  public async evaluate(intent: Intent): Promise<AssistantPreviewResult> {
    const normalizedPrompt = intent.prompt.toLowerCase();
    const globalKeywords = ['todo', 'todas', 'casa', 'global'];
    const hasGlobalKeyword = globalKeywords.some(kw => normalizedPrompt.includes(kw));

    if (intent.type === 'unknown') {
      return {
        prompt: intent.prompt,
        intentType: 'unknown',
        requiresConfirmation: false,
        summary: 'No pude interpretar esa instrucción.',
        reason: intent.reason
      };
    }

    if (intent.type === 'scene') {
      const scene = await this.sceneRepository.findSceneById(intent.target);
      const targetName = scene ? scene.name : 'Desconocido';
      const estimatedActionCount = scene ? scene.actions.length : 0;

      return {
        prompt: intent.prompt,
        intentType: 'scene',
        requiresConfirmation: true,
        summary: `Se ejecutará la escena "${targetName}" con ${estimatedActionCount} acciones.`,
        reason: 'Las escenas siempre requieren confirmación.',
        estimatedActionCount,
        targetName
      };
    }

    if (intent.type === 'command') {
      const device = await this.deviceRepository.findDeviceById(intent.deviceId);
      const targetName = device ? device.name : 'Desconocido';
      
      const isTurnOff = intent.command === 'turn_off';
      const isTurnOn = intent.command === 'turn_on';
      const isPositionOrStateCommand = ['set_position', 'open', 'close', 'stop'].includes(intent.command);

      let requiresConfirmation = false;
      let reason = undefined;

      if ((isTurnOff || isTurnOn) && hasGlobalKeyword) {
        requiresConfirmation = true;
        reason = 'Comandos globales requieren confirmación.';
      } else if (isPositionOrStateCommand) {
        requiresConfirmation = true;
        reason = 'Comandos de movimiento o posición requieren confirmación.';
      }

      return {
        prompt: intent.prompt,
        intentType: 'command',
        requiresConfirmation,
        summary: requiresConfirmation 
          ? `Se enviará el comando "${intent.command}" a "${targetName}".`
          : `Ejecutando comando "${intent.command}" en "${targetName}".`,
        reason,
        estimatedActionCount: 1,
        targetName
      };
    }

    const _exhaustive: never = intent;
    return _exhaustive;
  }
}
