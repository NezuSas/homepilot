import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { LlmIntentInterpreterPort } from './ports/LlmIntentInterpreterPort';
import { AssistantMemoryPort } from './ports/AssistantMemoryPort';

export type Intent = 
  | { type: 'scene'; target: string; prompt: string }
  | { type: 'command'; deviceId: string; command: string; params?: Record<string, unknown>; prompt: string }
  | { type: 'unknown'; prompt: string; reason: string };

/**
 * IntentInterpreterService
 * 
 * V1: Simple deterministic parsing of natural language prompts.
 * Uses repositories to resolve entities by keywords/name.
 */
export class IntentInterpreterService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly llmInterpreter?: LlmIntentInterpreterPort,
    private readonly memoryService?: AssistantMemoryPort
  ) {}

  public async interpret(prompt: string): Promise<Intent> {
    const isLlmEnabled = process.env.OLLAMA_ENABLED === 'true';

    if (isLlmEnabled && this.llmInterpreter) {
      try {
        const intent = await this.llmInterpreter.interpret(prompt);
        if (intent && intent.type !== 'unknown') {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Assistant] LLM interpreted: ${prompt} -> ${intent.type}`);
          }
          return intent;
        }
      } catch (error) {
        // Fallback on any error
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Assistant] LLM interpretation failed, falling back to deterministic.');
        }
      }
    }

    return this.interpretDeterministic(prompt);
  }

  private async interpretDeterministic(prompt: string): Promise<Intent> {
    const normalized = prompt.toLowerCase().trim();
    const offKeywords = ['apaga', 'apagar', 'apagado', 'desactivar', 'off'];
    const onKeywords = ['prende', 'encender', 'encendido', 'activar', 'on'];

    // V1 Pronouns exact matches
    const offPronouns = ['apágala', 'apágalo', 'apágalas', 'apágalos'];
    const onPronouns = ['préndela', 'préndelo', 'préndelas', 'préndelos', 'enciéndela', 'enciéndelo', 'enciéndelas', 'enciéndelos'];

    if (offPronouns.includes(normalized) || onPronouns.includes(normalized)) {
      if (this.memoryService) {
        const lastDeviceId = await this.memoryService.getLastDeviceUsed();
        if (lastDeviceId) {
          return {
            type: 'command',
            deviceId: lastDeviceId,
            command: offPronouns.includes(normalized) ? 'turn_off' : 'turn_on',
            prompt
          };
        }
      }
      return {
        type: 'unknown',
        prompt,
        reason: 'Missing recent device context to resolve pronoun.'
      };
    }

    // 1. Scene mapping
    if (normalized.includes('todo')) {
      const isTurnOff = offKeywords.some(kw => normalized.includes(kw));
      const isTurnOn = onKeywords.some(kw => normalized.includes(kw));
      
      if (isTurnOff || isTurnOn) {
        const keywords = isTurnOff ? offKeywords : onKeywords;
        const scenes = await this.sceneRepository.findAll();
        
        const found = scenes.find(s => {
          const name = s.name.toLowerCase();
          return name.includes('todo') && keywords.some(kw => name.includes(kw));
        });

        if (found) {
          return { type: 'scene', target: found.id, prompt };
        }
        return { type: 'unknown', prompt, reason: `No scene found matching "todo" with ${isTurnOff ? 'off' : 'on'} keywords` };
      }
    }

    // 2. Command mapping (V1: Simple keyword matcher)
    if (normalized.includes('luz') || normalized.includes('lámpara') || normalized.includes('foco')) {
      const isTurnOn = onKeywords.some(kw => normalized.includes(kw));
      const isTurnOff = offKeywords.some(kw => normalized.includes(kw));

      if (isTurnOn || isTurnOff) {
        const command = isTurnOn ? 'turn_on' : 'turn_off';
        const devices = await this.deviceRepository.findAll();
        
        // V1 Matcher: find by name containing keywords
        const found = devices.find(d => {
          const name = d.name.toLowerCase();
          // Check location keywords
          if (normalized.includes('sala') && !name.includes('sala')) return false;
          if (normalized.includes('cocina') && !name.includes('cocina')) return false;
          if (normalized.includes('cuarto') && !name.includes('cuarto')) return false;
          
          return name.includes('luz') || name.includes('lámpara') || name.includes('foco');
        });

        if (found) {
          return { type: 'command', deviceId: found.id, command, prompt };
        }
        return { type: 'unknown', prompt, reason: 'Device not found matching the description' };
      }
    }

    return { type: 'unknown', prompt, reason: 'Command not understood' };
  }
}
