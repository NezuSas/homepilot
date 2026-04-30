import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';

export interface FastPathResult {
  deviceId: string;
  deviceName: string;
  command: DeviceCommandV1;
  confidence: number;
}

export class AssistantFastPathResolver {
  private readonly STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'una', 'un', 'unos', 'unas', 'por', 'favor', 'porfa', 'en', 'mi', 'mis']);
  private readonly TYPO_MAP: Record<string, string> = {
    'luy': 'luz',
    'luces': 'luz',
    'cosina': 'cocina',
    'cosinna': 'cocina',
    'abitacion': 'habitacion',
    'avitecion': 'habitacion',
    'foco': 'luz', // sometimes helpful to map common synonyms if exact match fails
  };

  private readonly TURN_ON_VERBS = ['prende', 'prender', 'enciende', 'encender', 'activa', 'activar'];
  private readonly TURN_OFF_VERBS = ['apaga', 'apagar', 'desactiva', 'desactivar'];
  private readonly TOGGLE_VERBS = ['alterna', 'alternar', 'toggle'];

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove diacritics
      .replace(/[^\w\s]/gi, '') // remove punctuation
      .trim();
  }

  private cleanTypos(text: string): string {
    return text.split(/\s+/).map(token => this.TYPO_MAP[token] || token).join(' ');
  }

  public resolve(prompt: string, devices: Device[]): FastPathResult | null {
    const skip = (reason: string) => {
      console.info(`[ASSISTANT_FAST_PATH_SKIPPED] ${JSON.stringify({ prompt, reason })}`);
      return null;
    };

    const normPrompt = this.normalizeText(prompt);
    if (!normPrompt) return skip('empty_prompt');

    // 1. Extract command
    let command: DeviceCommandV1 | null = null;
    let targetPhrase = normPrompt;

    for (const verb of this.TURN_ON_VERBS) {
      if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
        command = 'turn_on';
        targetPhrase = normPrompt.substring(verb.length).trim();
        break;
      }
    }
    if (!command) {
      for (const verb of this.TURN_OFF_VERBS) {
        if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
          command = 'turn_off';
          targetPhrase = normPrompt.substring(verb.length).trim();
          break;
        }
      }
    }
    if (!command) {
      for (const verb of this.TOGGLE_VERBS) {
        if (normPrompt.startsWith(verb + ' ') || normPrompt === verb) {
          command = 'toggle';
          targetPhrase = normPrompt.substring(verb.length).trim();
          break;
        }
      }
    }

    if (!command) return skip('no_command_verb_found');
    if (!targetPhrase) return skip('no_target_phrase');

    // 2. Remove stopwords and fix typos
    const tokens = targetPhrase.split(/\s+/).filter(t => !this.STOPWORDS.has(t));
    if (tokens.length === 0) return skip('only_stopwords_in_target');
    
    const cleanedTarget = this.cleanTypos(tokens.join(' '));

    // 3. Score devices
    const scoredDevices = devices.map(device => {
      const devName = this.normalizeText(device.name);
      const cleanedDevName = this.cleanTypos(devName.split(/\s+/).filter(t => !this.STOPWORDS.has(t)).join(' '));
      
      let score = 0;
      
      if (cleanedTarget === cleanedDevName) {
        score = 1.0;
      } else if (cleanedDevName.includes(cleanedTarget) || cleanedTarget.includes(cleanedDevName)) {
        // Very basic contains
        score = 0.85; 
      } else {
        // Token overlap
        const targetTokens = new Set(cleanedTarget.split(/\s+/));
        const devTokens = new Set(cleanedDevName.split(/\s+/));
        let matchCount = 0;
        for (const t of targetTokens) {
          if (devTokens.has(t)) matchCount++;
        }
        
        // Jaccard similarity-like approach
        const overlap = matchCount / Math.max(targetTokens.size, devTokens.size);
        if (overlap >= 0.8) {
          score = 0.9;
        } else if (overlap >= 0.5) {
          score = 0.7;
        }
      }

      return { device, score };
    }).filter(d => d.score >= 0.9);

    if (scoredDevices.length === 0) return skip('no_strong_match');
    
    // Sort by highest score
    scoredDevices.sort((a, b) => b.score - a.score);

    // If ambiguous (multiple top scorers with the exact same highest score)
    const topScore = scoredDevices[0].score;
    const topMatches = scoredDevices.filter(d => d.score === topScore);
    
    if (topMatches.length > 1) {
      return skip('ambiguous_multiple_matches');
    }

    const bestMatch = topMatches[0];
    
    console.info(`[ASSISTANT_FAST_PATH_APPROVED] ${JSON.stringify({
      prompt,
      deviceId: bestMatch.device.id,
      deviceName: bestMatch.device.name,
      command,
      confidence: bestMatch.score
    })}`);

    return {
      deviceId: bestMatch.device.id,
      deviceName: bestMatch.device.name,
      command,
      confidence: bestMatch.score
    };
  }
}
