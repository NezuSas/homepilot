import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';

export interface FastPathResult {
  deviceId: string;
  deviceName: string;
  command: DeviceCommandV1;
  confidence: number;
}

interface CommandMatch {
  command: DeviceCommandV1;
  targetPhrase: string;
}

interface IndexedCommandMatch extends CommandMatch {
  commandStartIndex: number;
  phraseTokenCount: number;
}

export class AssistantFastPathResolver {
  private readonly STOPWORDS = new Set([
    'a',
    'al',
    'all',
    'can',
    'con',
    'could',
    'cuando',
    'de',
    'del',
    'el',
    'en',
    'favor',
    'favorcito',
    'for',
    'hey',
    'homepilot',
    'la',
    'las',
    'los',
    'me',
    'mi',
    'mis',
    'necesito',
    'oye',
    'please',
    'por',
    'porfa',
    'puedas',
    'puede',
    'puedes',
    'podria',
    'podrias',
    'que',
    'quiero',
    'quisiera',
    'the',
    'todo',
    'todos',
    'todas',
    'un',
    'una',
    'unos',
    'unas',
    'would',
    'you'
  ]);
  private readonly TYPO_MAP: Record<string, string> = {
    'luy': 'luz',
    'luces': 'luz',
    'cosina': 'cocina',
    'cosinna': 'cocina',
    'abitacion': 'habitacion',
    'avitecion': 'habitacion',
    'foco': 'luz', // sometimes helpful to map common synonyms if exact match fails
    'focos': 'luz',
  };

  private readonly GENERIC_TARGETS = new Set([
    'blind', 'cortina', 'curtain', 'cover', 'device', 'dispositivo', 'interruptor',
    'light', 'luz', 'persiana', 'switch'
  ]);
  private readonly BULK_TERMS = new Set(['all', 'everything', 'todo', 'todos', 'todas']);
  private readonly MANAGEMENT_TERMS = new Set(['automation', 'automatizacion', 'automatizaciones', 'escena', 'escenas', 'routine', 'rutina', 'rutinas', 'scene', 'scenes']);
  private readonly EXCLUSION_TERMS = new Set(['except', 'excepto', 'menos']);
  private readonly MEMORY_REFERENCE_TERMS = new Set(['aquel', 'aquella', 'esa', 'ese', 'eso', 'esta', 'este', 'esto', 'primera', 'primero', 'segunda', 'segundo']);
  private readonly PERSONAL_ROOM_PHRASES = ['mi cuarto', 'mi habitacion', 'my room', 'my bedroom'];
  private readonly TURN_ON_PHRASES = ['prende', 'prender', 'prendes', 'enciende', 'encender', 'enciendes', 'activa', 'activar', 'activas', 'turn on', 'switch on'];
  private readonly TURN_OFF_PHRASES = ['apaga', 'apagar', 'apagas', 'desactiva', 'desactivar', 'desactivas', 'turn off', 'switch off'];
  private readonly TOGGLE_PHRASES = ['alterna', 'alternar', 'alternas', 'toggle'];
  private readonly OPEN_PHRASES = ['abre', 'abrir', 'abres', 'open'];
  private readonly CLOSE_PHRASES = ['cierra', 'cerrar', 'cierras', 'close'];
  private readonly COMMAND_PHRASES: Array<{ command: DeviceCommandV1; phrase: string }> = [
    ...this.TURN_ON_PHRASES.map(phrase => ({ command: 'turn_on' as const, phrase })),
    ...this.TURN_OFF_PHRASES.map(phrase => ({ command: 'turn_off' as const, phrase })),
    ...this.TOGGLE_PHRASES.map(phrase => ({ command: 'toggle' as const, phrase })),
    ...this.OPEN_PHRASES.map(phrase => ({ command: 'open' as const, phrase })),
    ...this.CLOSE_PHRASES.map(phrase => ({ command: 'close' as const, phrase })),
  ].sort((a, b) => b.phrase.split(/\s+/).length - a.phrase.split(/\s+/).length);

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove diacritics
      .replace(/[^\w\s]/gi, ' ') // remove punctuation
      .replace(/\ba\s+pagar\b/g, 'apagar')
      .replace(/\ba\s+paga\b/g, 'apaga')
      .replace(/\ba\s+pa\b/g, 'apaga')
      .replace(/\bapage\b/g, 'apaga')
      .replace(/\bla\s+luz\s+a\s+la\s+sala\b/g, 'la luz de la sala')
      .replace(/\bensaila\b/g, 'en sala')
      .replace(/\bensala\b/g, 'en sala')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanTypos(text: string): string {
    return text.split(/\s+/).map(token => this.TYPO_MAP[token] || token).join(' ');
  }

  private containsCommandPhrase(text: string): boolean {
    const tokens = text.split(/\s+/).filter(Boolean);

    return this.COMMAND_PHRASES.some(entry => {
      const phraseTokens = entry.phrase.split(/\s+/);
      const lastStartIndex = tokens.length - phraseTokens.length;

      for (let startIndex = 0; startIndex <= lastStartIndex; startIndex += 1) {
        if (phraseTokens.every((token, offset) => tokens[startIndex + offset] === token)) {
          return true;
        }
      }

      return false;
    });
  }

  private findCommandMatch(normPrompt: string): CommandMatch | null {
    const promptTokens = normPrompt.split(/\s+/).filter(Boolean);
    const matches: IndexedCommandMatch[] = [];

    for (const entry of this.COMMAND_PHRASES) {
      const phraseTokens = entry.phrase.split(/\s+/);
      const lastStartIndex = promptTokens.length - phraseTokens.length;

      for (let startIndex = 0; startIndex <= lastStartIndex; startIndex += 1) {
        const matchesPhrase = phraseTokens.every((token, offset) => promptTokens[startIndex + offset] === token);

        if (!matchesPhrase) {
          continue;
        }

        matches.push({
          command: entry.command,
          targetPhrase: promptTokens.slice(startIndex + phraseTokens.length).join(' ').trim(),
          commandStartIndex: startIndex,
          phraseTokenCount: phraseTokens.length
        });
      }
    }

    matches.sort((a, b) => {
      if (a.commandStartIndex !== b.commandStartIndex) {
        return a.commandStartIndex - b.commandStartIndex;
      }

      return b.phraseTokenCount - a.phraseTokenCount;
    });

    return matches[0] || null;
  }

  public resolve(prompt: string, devices: Device[]): FastPathResult | null {
    const skip = (reason: string) => {
      console.info(`[ASSISTANT_FAST_PATH_SKIPPED] ${JSON.stringify({ prompt, reason })}`);
      return null;
    };

    const normPrompt = this.normalizeText(prompt);
    if (!normPrompt) return skip('empty_prompt');
    if (normPrompt.split(/\s+/).some(token => this.MANAGEMENT_TERMS.has(token))) return skip('management_prompt');
    if (this.PERSONAL_ROOM_PHRASES.some(phrase => normPrompt.includes(phrase))) return skip('personal_room_alias_required');

    // 1. Extract command from natural phrases like "oye homepilot me puedes apagar..."
    const commandMatch = this.findCommandMatch(normPrompt);

    if (!commandMatch) return skip('no_command_verb_found');
    if (!commandMatch.targetPhrase) return skip('no_target_phrase');

    // 2. Remove stopwords and fix typos
    const rawTargetTokens = commandMatch.targetPhrase.split(/\s+/);
    if (rawTargetTokens.some(token => this.BULK_TERMS.has(token))) return skip('bulk_target');
    if (rawTargetTokens.some(token => this.EXCLUSION_TERMS.has(token))) return skip('exclusion_target');
    if (this.containsCommandPhrase(commandMatch.targetPhrase)) return skip('multi_command_target');

    const tokens = rawTargetTokens.filter(t => !this.STOPWORDS.has(t));
    if (tokens.length === 0) return skip('only_stopwords_in_target');
    const concreteTokens = tokens.filter(token => !this.MEMORY_REFERENCE_TERMS.has(token));
    if (concreteTokens.length === 0) return skip('memory_reference_target');
    
    const cleanedTarget = this.cleanTypos(concreteTokens.join(' '));
    if (this.GENERIC_TARGETS.has(cleanedTarget)) {
      const availableMatches = devices.filter(device => {
        const state = device.lastKnownState?.state;
        if (state === 'unavailable') return false;

        const type = device.type.toLowerCase();
        if (['blind', 'cortina', 'curtain', 'cover', 'persiana'].includes(cleanedTarget)) {
          return type === 'cover' && ['open', 'close'].includes(commandMatch.command);
        }
        return false;
      });

      if (availableMatches.length !== 1) return skip('generic_target_without_unique_available_device');

      const device = availableMatches[0];
      return {
        deviceId: device.id,
        deviceName: device.name,
        command: commandMatch.command,
        confidence: 1.0
      };
    }

    // 3. Score devices
    const scoredDevices = devices.map(device => {
      const devName = this.normalizeText(device.name);
      const cleanedDevName = this.cleanTypos(devName.split(/\s+/).filter(t => !this.STOPWORDS.has(t)).join(' '));
      
      let score = 0;
      
      if (cleanedTarget === cleanedDevName) {
        score = 1.0;
      } else if (cleanedTarget.split(/\s+/).length > 1 && (cleanedDevName.includes(cleanedTarget) || cleanedTarget.includes(cleanedDevName))) {
        score = 0.92; 
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
      command: commandMatch.command,
      confidence: bestMatch.score
    })}`);

    return {
      deviceId: bestMatch.device.id,
      deviceName: bestMatch.device.name,
      command: commandMatch.command,
      confidence: bestMatch.score
    };
  }
}
