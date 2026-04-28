import { Intent } from './ports/IntentInterpreterPort';
import { AssistantPreviewResult } from '../domain/AssistantPreviewResult';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { AssistantConfirmationPolicyPort } from './ports/AssistantConfirmationPolicyPort';

export class AssistantConfirmationPolicy implements AssistantConfirmationPolicyPort {
  constructor(
    private readonly sceneRepository: SceneRepository,
    private readonly deviceRepository: DeviceRepository
  ) {}

  public async evaluate(intent: Intent, lang: string = 'es'): Promise<AssistantPreviewResult> {
    const t_eval = Date.now();
    const normalizedPrompt = intent.prompt.toLowerCase();
    const globalKeywords = lang === 'en' ? ['all', 'every', 'home', 'global'] : ['todo', 'todas', 'casa', 'global'];
    const hasGlobalKeyword = globalKeywords.some(kw => normalizedPrompt.includes(kw));
    const isEn = lang === 'en';

    const finalize = (res: AssistantPreviewResult) => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[AssistantConfirmationPolicy] evaluate took ${Date.now() - t_eval}ms`);
      }
      return res;
    };

    if (intent.type === 'unknown') {
      return finalize({
        prompt: intent.prompt,
        intentType: 'unknown',
        requiresConfirmation: false,
        summary: isEn ? 'I could not interpret that instruction.' : 'No pude interpretar esa instrucción.',
        reason: intent.reason
      });
    }

    if (intent.type === 'scene') {
      const scene = await this.sceneRepository.findSceneById(intent.target);
      const targetName = scene ? scene.name : (isEn ? 'Unknown' : 'Desconocido');
      const estimatedActionCount = scene ? scene.actions.length : 0;

      return finalize({
        prompt: intent.prompt,
        intentType: 'scene',
        requiresConfirmation: true,
        summary: isEn 
          ? `Scene "${targetName}" will be executed with ${estimatedActionCount} actions.`
          : `Se ejecutará la escena "${targetName}" con ${estimatedActionCount} acciones.`,
        reason: isEn ? 'Scenes always require confirmation.' : 'Las escenas siempre requieren confirmación.',
        estimatedActionCount,
        targetName
      });
    }

    if (intent.type === 'command') {
      const device = await this.deviceRepository.findDeviceById(intent.deviceId);
      const targetName = device ? device.name : (isEn ? 'Unknown' : 'Desconocido');
      
      const isTurnOff = intent.command === 'turn_off';
      const isTurnOn = intent.command === 'turn_on';
      const isPositionOrStateCommand = ['set_position', 'open', 'close', 'stop'].includes(intent.command);

      let requiresConfirmation = false;
      let reason = undefined;

      if ((isTurnOff || isTurnOn) && hasGlobalKeyword) {
        requiresConfirmation = true;
        reason = isEn ? 'Global commands require confirmation.' : 'Comandos globales requieren confirmación.';
      } else if (isPositionOrStateCommand) {
        requiresConfirmation = true;
        reason = isEn ? 'Movement or position commands require confirmation.' : 'Comandos de movimiento o posición requieren confirmación.';
      }

      const summaryText = isEn
        ? (requiresConfirmation ? `Command "${intent.command}" will be sent to "${targetName}".` : `Executing command "${intent.command}" on "${targetName}".`)
        : (requiresConfirmation ? `Se enviará el comando "${intent.command}" a "${targetName}".` : `Ejecutando comando "${intent.command}" en "${targetName}".`);

      return finalize({
        prompt: intent.prompt,
        intentType: 'command',
        requiresConfirmation,
        summary: summaryText,
        reason,
        estimatedActionCount: 1,
        targetName
      });
    }

    if (intent.type === 'multi_command') {
      const estimatedActionCount = intent.actions.length;
      return finalize({
        prompt: intent.prompt,
        intentType: 'multi_command',
        requiresConfirmation: true, // Always require confirmation for multi-commands
        summary: isEn
          ? `I will execute ${estimatedActionCount} actions.`
          : `Voy a ejecutar ${estimatedActionCount} acciones.`,
        reason: isEn 
          ? 'Multiple actions always require confirmation.' 
          : 'Comandos múltiples siempre requieren confirmación.',
        estimatedActionCount
      });
    }

    if (intent.type === 'explain') {
      return finalize({
        prompt: intent.prompt,
        intentType: 'unknown', // Explain doesn't have its own type in AssistantPreviewResult yet, using unknown as it's informative
        requiresConfirmation: false,
        summary: isEn ? 'Providing explanation for the last action.' : 'Proporcionando explicación de la última acción.'
      });
    }

    if (intent.type === 'retry') {
      return finalize({
        prompt: intent.prompt,
        intentType: 'unknown',
        requiresConfirmation: false,
        summary: isEn ? 'Retrying the last failed action.' : 'Reintentando la última acción fallida.'
      });
    }

    if (intent.type === 'company_info') {
      return finalize({
        prompt: intent.prompt,
        intentType: 'unknown',
        requiresConfirmation: false,
        summary: isEn ? 'Providing official company information about NEZU S.A.S.' : 'Proporcionando información oficial sobre NEZU S.A.S.'
      });
    }

    const _exhaustive: never = intent;
    return _exhaustive;
  }
}
