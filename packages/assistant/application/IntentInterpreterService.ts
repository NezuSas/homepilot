import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { LlmIntentInterpreterPort } from './ports/LlmIntentInterpreterPort';
import { AssistantMemoryPort } from './ports/AssistantMemoryPort';
import { IntentInterpreterPort, Intent } from './ports/IntentInterpreterPort';

/**
 * IntentInterpreterService
 * 
 * V1: Simple deterministic parsing of natural language prompts.
 * Uses repositories to resolve entities by keywords/name.
 */
export class IntentInterpreterService implements IntentInterpreterPort {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly llmInterpreter?: LlmIntentInterpreterPort,
    private readonly memoryService?: AssistantMemoryPort
  ) {}

  public async interpret(prompt: string): Promise<Intent> {
    const t0 = Date.now();
    
    // 1. Always try deterministic first (fast path)
    const t_det = Date.now();
    const deterministicResult = await this.interpretDeterministic(prompt);
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[IntentInterpreter] deterministic path: ${Date.now() - t_det}ms → ${deterministicResult.type}`);
    }

    if (deterministicResult.type !== 'unknown') {
      return deterministicResult;
    }

    // 2. Fallback to LLM if enabled and deterministic failed
    const isLlmEnabled = process.env.OLLAMA_ENABLED === 'true';
    if (isLlmEnabled && this.llmInterpreter) {
      const t_llm = Date.now();
      try {
        const intent = await this.llmInterpreter.interpret(prompt);
        if (intent && intent.type !== 'unknown') {
          if (process.env.NODE_ENV !== 'production') {
            console.debug(`[IntentInterpreter] LLM path: ${Date.now() - t_llm}ms → ${intent.type}`);
          }
          return intent;
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Assistant] LLM interpretation failed:', error instanceof Error ? error.message : String(error));
        }
      }
    }

    return deterministicResult;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private containsKeyword(text: string, keywords: string[]): boolean {
    return keywords.some(kw => {
      if (kw.length <= 3) {
        // Short keywords like 'on', 'off' require word boundaries to avoid false positives (e.g., 'seccion')
        const regex = new RegExp(`\\b${this.escapeRegExp(kw)}\\b`, 'i');
        return regex.test(text);
      }
      return text.includes(kw);
    });
  }

  private normalizeSpanishCommand(prompt: string): string {
    let normalized = prompt.toLowerCase();
    
    // Normalize common variations of "enciende/prende/apaga" with pronouns/suffixes
    // enciendeme, encendeme -> enciende
    normalized = normalized.replace(/\b(encend|enciend)eme\b/g, 'enciende');
    normalized = normalized.replace(/\b(encend|enciend)elo\b/g, 'enciende');
    
    // apagame -> apaga
    normalized = normalized.replace(/\bapagame\b/g, 'apaga');
    normalized = normalized.replace(/\bapagalo\b/g, 'apaga');
    
    // prendeme -> prende
    normalized = normalized.replace(/\bprendeme\b/g, 'prende');
    normalized = normalized.replace(/\bprendelo\b/g, 'prende');

    return normalized;
  }

  private async interpretDeterministic(prompt: string): Promise<Intent> {
    const normalized = this.normalizeSpanishCommand(prompt).trim();
    const offKeywords = ['apaga', 'apagar', 'apagado', 'desactivar', 'off'];
    const onKeywords = ['prende', 'enciende', 'encender', 'encendido', 'activar', 'on'];

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
      const isTurnOff = this.containsKeyword(normalized, offKeywords);
      const isTurnOn = this.containsKeyword(normalized, onKeywords);
      
      if (isTurnOff || isTurnOn) {
        // Resolve ambiguity
        let finalKeywords = isTurnOff ? offKeywords : onKeywords;
        if (isTurnOff && isTurnOn) {
          const hasExplicitOff = offKeywords.some(kw => normalized.includes(kw) && kw.length > 3) || offPronouns.includes(normalized);
          const hasExplicitOn = onKeywords.some(kw => normalized.includes(kw) && kw.length > 3) || onPronouns.includes(normalized);
          
          if (hasExplicitOff && !hasExplicitOn) finalKeywords = offKeywords;
          else if (hasExplicitOn && !hasExplicitOff) finalKeywords = onKeywords;
          else return { type: 'unknown', prompt, reason: 'Ambiguous command intent.' };
        }

        const scenes = await this.sceneRepository.findAll();
        const found = scenes.find(s => {
          const name = s.name.toLowerCase();
          return name.includes('todo') && finalKeywords.some(kw => name.includes(kw));
        });

        if (found) {
          return { type: 'scene', target: found.id, prompt };
        }
        return { type: 'unknown', prompt, reason: `No scene found matching "todo" with ${isTurnOff ? 'off' : 'on'} keywords` };
      }
    }

    // 2. Command mapping (V1: Simple keyword matcher)
    if (normalized.includes('luz') || normalized.includes('lámpara') || normalized.includes('foco')) {
      let isTurnOn = this.containsKeyword(normalized, onKeywords);
      let isTurnOff = this.containsKeyword(normalized, offKeywords);

      if (isTurnOn || isTurnOff) {
        // Resolve ambiguity
        let command: 'turn_on' | 'turn_off' = isTurnOn ? 'turn_on' : 'turn_off';
        
        if (isTurnOn && isTurnOff) {
          const hasExplicitOff = offKeywords.some(kw => normalized.includes(kw) && kw.length > 3) || offPronouns.includes(normalized);
          const hasExplicitOn = onKeywords.some(kw => normalized.includes(kw) && kw.length > 3) || onPronouns.includes(normalized);
          
          if (hasExplicitOff && !hasExplicitOn) command = 'turn_off';
          else if (hasExplicitOn && !hasExplicitOff) command = 'turn_on';
          else return { type: 'unknown', prompt, reason: 'Ambiguous command intent.' };
        }

        const devices = await this.deviceRepository.findAll();
        
        // V1 Matcher: find by name containing keywords
        const found = devices.find(d => {
          const name = d.name.toLowerCase();
          // Check location keywords
          if (normalized.includes('sala') && !name.includes('sala')) return false;
          if (normalized.includes('cocina') && !name.includes('cocina')) return false;
          if (normalized.includes('cuarto') && !name.includes('cuarto')) return false;
          if (normalized.includes('escritorio') && !name.includes('escritorio')) return false;
          
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
