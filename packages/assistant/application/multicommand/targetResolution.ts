import { Device } from '../../../devices/domain/types';
import { Room } from '../../../topology/domain/types';
import { AssistantMultiCommandResult } from '../ports/IntentInterpreterPort';
import { normalizePrompt } from './textRules';

/** Resuelve el segmento de un comando compuesto a dispositivos concretos, o pide aclaración. */
export async function resolveTargets(
  segment: string,
  allDevices: readonly Device[],
  allRooms: readonly Room[]
): Promise<{ type: 'match', devices: Device[] } | AssistantMultiCommandResult> {
  // 1. Check for explicit bulk intent in segment — only then allow room-wide expansion.
  // Single-target phrases like "luz sala" or "cocina" must NOT silently expand to all room devices.
  const hasBulkKeyword = /\b(todo|todas\s+las\s+luces|todas|everything|all\s+lights|all)\b/i.test(segment);

  // 2. Try Room Match
  const roomMatch = allRooms.find(r => segment.includes(normalizePrompt(r.name)));
  if (roomMatch) {
    if (hasBulkKeyword) {
      // Explicit bulk: expand all controllable devices in room
      const roomDevices = allDevices.filter(d => d.roomId === roomMatch.id);
      if (roomDevices.length > 0) return { type: 'match', devices: [...roomDevices] };
    } else {
      // Singular reference to a room: must clarify — never auto-expand
      const roomDevices = allDevices.filter(d => d.roomId === roomMatch.id);
      if (roomDevices.length === 0) {
        return { type: 'failure', message: `No encontré dispositivos en "${roomMatch.name}".` };
      }
      return {
        type: 'clarificationRequired',
        options: roomDevices.map(d => ({ id: d.id, label: d.name, kind: 'device' as const })),
        originalSegment: segment
      };
    }
  }

  // 3. Score-based device matching (like single commands)
  const scored = allDevices.map(d => {
    const name = normalizePrompt(d.name);
    let score = 0;

    if (name === segment) score = 100;
    else if (segment.includes(name)) score = 50;
    else if (name.split(' ').some(token => segment.includes(token))) score = 10;

    return { device: d, score };
  }).filter(item => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const topScore = scored[0].score;
    const bestMatches = scored.filter(item => item.score === topScore).map(item => item.device);

    if (bestMatches.length === 1) {
      return { type: 'match', devices: [...bestMatches] };
    } else {
      return {
        type: 'clarificationRequired',
        options: bestMatches.map(d => ({ id: d.id, label: d.name, kind: 'device' as const })),
        originalSegment: segment
      };
    }
  }

  return { type: 'failure', message: `No pude encontrar qué controlar en: "${segment}"` };
}
