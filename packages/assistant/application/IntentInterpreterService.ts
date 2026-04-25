import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';

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
    private readonly sceneRepository: SceneRepository
  ) {}

  public async interpret(prompt: string): Promise<Intent> {
    const normalized = prompt.toLowerCase().trim();
    const offKeywords = ['apaga', 'apagar', 'apagado', 'desactivar', 'off'];
    const onKeywords = ['prende', 'encender', 'encendido', 'activar', 'on'];

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
