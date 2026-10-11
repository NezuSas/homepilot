import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Device } from '../../../devices/domain/types';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import { buildVocabulary, correctAgainstVocabulary, normalizeText as sharedNormalizeText, levenshteinDistance } from '../textMatching';
import type { AssistantConversationResponse } from './conversationTypes';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Device matching and fuzzy candidate suggestions for a prompt. */
export class DeviceResolver extends ConversationCollaborator {
  public async findMatchingDevices(prompt: string, userId: string = 'system'): Promise<Device[]> {
    let devices = await this.deps.permissionGate.getAuthorizedDevices(userId);

    // Filter out non-controllable/deprecated devices
    devices = devices.filter(d => this.deps.scopeFilter.isDeviceAvailable(d));

    // Resolve transcription spelling and simple plural drift only against this
    // user's authorized inventory. No household name is ever hardcoded here.
    const vocabulary = buildVocabulary(devices.map((device) => device.name));
    const normalized = correctAgainstVocabulary(normalizeAssistantPrompt(prompt), vocabulary);

    // 1. Check for Exact Match first (highest priority)
    const exactMatch = devices.find(d => normalizeAssistantPrompt(d.name) === normalized);
    if (exactMatch) return [exactMatch];

    // 2. Phrase Matching (Requirement: normalized prompt contains device name)
    // "prende luz escritorio" -> matchea "luz escritorio" pero no "luz cocina"
    const phraseMatches = devices.filter(d => {
      const deviceName = normalizeAssistantPrompt(d.name);
      return normalized.includes(deviceName);
    });

    // Si hay un único match por frase contenida, lo devolvemos directamente (Requirement A)
    if (phraseMatches.length === 1) {
      return [phraseMatches[0]];
    }

    if (phraseMatches.length > 1) {
      // Si hay varios, ordenamos por nombre más largo (más específico) y luego por uso (Requirement B)
      const mostUsed = await this.deps.learningService.getMostUsedDevices(userId);
      const usageMap = new Map(mostUsed.map(u => [u.entityId, u.count]));

      phraseMatches.sort((a, b) => {
        if (b.name.length !== a.name.length) return b.name.length - a.name.length;
        const usageA = usageMap.get(a.id) || 0;
        const usageB = usageMap.get(b.id) || 0;
        return usageB - usageA;
      });

      return phraseMatches.slice(0, 3);
    }

    // 3. Fallback: Token-based matching (Requirement C: "Solo si no hay phraseMatches usar token/fuzzy ranking")
    // "prende luz" -> no matchea ninguna frase completa, buscamos tokens
    const scored = devices.map(d => {
      const name = normalizeAssistantPrompt(d.name);
      const tokens = name.split(' ');
      let score = 0;

      const targetTokens = normalized.split(' ').filter(t => t.length > 2 && !['prende', 'enciende', 'apaga', 'turn', 'on', 'off', 'las', 'los', 'del', 'the'].includes(t));

      let matchCount = 0;
      for (const token of tokens) {
        if (targetTokens.some(tt => tt.includes(token) || token.includes(tt))) {
          matchCount++;
        }
      }

      let targetMatchCount = 0;
      for (const tt of targetTokens) {
        if (tokens.some(token => token.includes(tt) || tt.includes(token))) {
          targetMatchCount++;
        }
      }

      const overlap = tokens.length > 0 ? (matchCount / tokens.length) : 0;
      const targetOverlap = targetTokens.length > 0 ? (targetMatchCount / targetTokens.length) : 0;

      if (overlap >= 0.5 && targetOverlap >= 0.6) {
        score = 10;
      } else if (overlap === 1.0) {
        score = 10;
      }

      return { device: d, score };
    }).filter(item => item.score > 0);

    if (scored.length === 0) return [];

    const mostUsedFallback = await this.deps.learningService.getMostUsedDevices(userId);
    const usageMapFallback = new Map(mostUsedFallback.map(u => [u.entityId, u.count]));

    scored.sort((a, b) => {
      const usageA = usageMapFallback.get(a.device.id) || 0;
      const usageB = usageMapFallback.get(b.device.id) || 0;
      return usageB - usageA;
    });

    return scored.slice(0, 3).map(item => item.device);
  }

  public findFuzzyCandidateSuggestions(targetPhrase: string, devices: readonly Device[], language: string, command: DeviceCommandV1, originalPrompt: string): AssistantConversationResponse | null {
    if (!targetPhrase || targetPhrase.trim().length < 3) return null;

    const targetNorm = sharedNormalizeText(targetPhrase);

    let bestMatch: Device | null = null;
    let bestScore = 0; // 0 to 1, where 1 is exact match

    for (const d of devices) {
      if (!this.deps.scopeFilter.isDeviceAvailable(d)) continue;
      // Note: we don't strictly filter by supportsCommand here because maybe they asked "prende la tv" but it's a sensor?
      // Actually we should only suggest controllable devices if it's a command.
      if (!this.deps.scopeFilter.isControllableDevice(d, command)) continue;

      const nameNorm = sharedNormalizeText(d.name);

      // Calculate similarity
      const distance = levenshteinDistance(targetNorm, nameNorm);
      const maxLength = Math.max(targetNorm.length, nameNorm.length);
      const similarity = maxLength === 0 ? 1 : 1 - (distance / maxLength);

      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = d;
      }
    }

    // High confidence threshold (e.g. "lux sal" vs "luz sala") -> usually > 0.7 similarity
    if (bestMatch && bestScore >= 0.7) {
      return {
        type: 'clarification',
        message: getAssistantResponseText('fuzzy.suggestion', language, { targetPhrase, deviceName: bestMatch.name }),
        clarification: {
          question: getAssistantResponseText('fuzzy.question', language, { deviceName: bestMatch.name }),
          options: [{ id: bestMatch.id, label: bestMatch.name, kind: 'device' }],
          pendingAction: {
            command,
            originalPrompt
          }
        }
      };
    }

    // Low confidence or no match
    return {
      type: 'answer',
      message: getAssistantResponseText('fuzzy.not_found', language, { targetPhrase })
    };
  }
}
