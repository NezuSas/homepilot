import { AssistantMultiCommandResult } from '../ports/IntentInterpreterPort';
import type { ScopeFilter } from '../ScopeFilter';
import { normalizeText, correctAgainstVocabulary, buildVocabulary } from '../textMatching';
import type { AuthorizedScope } from './AuthorizedScope';
import {
  BULK_WORDS,
  LIGHT_SYNONYMS_REGEX,
  ZONE_CATEGORY_REGEX,
  categoryMatchesDeviceName,
  inferCommandFromSegment,
  stripArticlesAndBulkWords,
} from './textRules';

/**
 * Handles "apaga CATEGORIA de/en [la zona/el area/...] NOMBRE" — a category
 * scoped to a room, generalizing beyond the deterministic room-bulk fast-path's
 * fixed keyword list. Returns null (never a failure) whenever the prompt isn't
 * confidently a zone/category command, so unrelated prompts fall through
 * untouched to whatever handles them next.
 */
export async function parseZoneCategoryCommand(
  originalPrompt: string,
  normalized: string,
  scope: AuthorizedScope,
  scopeFilter: ScopeFilter,
  userId?: string
): Promise<AssistantMultiCommandResult | null> {
  const match = normalized.match(ZONE_CATEGORY_REGEX);
  if (!match) return null;

  const command = inferCommandFromSegment(match[1]);
  if (!command) return null;

  const categoryPhrase = match[2].trim();
  const roomPhrase = match[3].trim();
  if (!roomPhrase) return null;

  const category = stripArticlesAndBulkWords(categoryPhrase);
  // A bare "todo"/"todas las luces" + room is already the deterministic room-bulk
  // fast-path's job — don't duplicate it here, only generalize beyond it.
  if (!category || BULK_WORDS.has(category) || category.length < 3) return null;

  const allRooms = await scope.getAuthorizedRooms(userId);
  const roomMatch = allRooms.find(r => {
    const roomName = normalizeText(r.name);
    return roomPhrase.includes(roomName) || roomName.includes(roomPhrase);
  });
  if (!roomMatch) return null;

  const allDevices = await scope.getAuthorizedDevices(userId);
  const isLightsOnly = LIGHT_SYNONYMS_REGEX.test(categoryPhrase);
  const vocabulary = buildVocabulary(allDevices.map(d => d.name));
  const correctedCategory = correctAgainstVocabulary(category, vocabulary);

  const matchingDevices = allDevices.filter(d => {
    if (d.roomId !== roomMatch.id) return false;
    if (isLightsOnly) return scopeFilter.isControllableForBulk(d, command, 'lights');
    return scopeFilter.isControllableForBulk(d, command, 'all') && categoryMatchesDeviceName(correctedCategory, d.name);
  });

  if (matchingDevices.length === 0) {
    return { type: 'failure', message: `No encontré "${category}" en "${roomMatch.name}".` };
  }

  return {
    type: 'success',
    intent: {
      type: 'multi_command',
      prompt: originalPrompt,
      actions: matchingDevices.map(d => ({ deviceId: d.id, command, targetName: d.name })),
      requiresConfirmation: true
    }
  };
}
