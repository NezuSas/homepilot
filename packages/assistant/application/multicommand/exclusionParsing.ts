import { Device } from '../../../devices/domain/types';
import { AssistantMultiCommandResult, MultiCommandAction } from '../ports/IntentInterpreterPort';
import type { ScopeFilter } from '../ScopeFilter';
import { normalizeText, correctAgainstVocabulary, buildVocabulary } from '../textMatching';
import type { AuthorizedScope } from './AuthorizedScope';
import {
  BULK_WORDS,
  EXCEPTION_SPLIT_REGEX,
  LIGHT_SYNONYMS_REGEX,
  categoryMatchesDeviceName,
  extractCategoryWord,
  inferCommandFromSegment,
  stripArticlesAndBulkWords,
} from './textRules';

/**
 * Handles "apaga todo/todas las luces/CATEGORIA menos X[, Y y Z]" — a bulk or
 * category-scoped command with one or more excluded devices/rooms/sub-categories.
 * Never partially applies: an exception term that can't be resolved fails the
 * whole command rather than silently being ignored.
 */
export async function parseExclusion(
  originalPrompt: string,
  normalized: string,
  exclusions: string[],
  scope: AuthorizedScope,
  scopeFilter: ScopeFilter,
  userId?: string
): Promise<AssistantMultiCommandResult> {
  let splitPoint = -1;
  let usedExclusion = '';

  for (const ex of exclusions) {
    const idx = normalized.indexOf(ex);
    if (idx !== -1) {
      splitPoint = idx;
      usedExclusion = ex;
      break;
    }
  }

  if (splitPoint === -1) return { type: 'failure', message: 'No exclusion found' };

  // Commas only matter as delimiters within the exception list; the base part
  // never needs them (and a stray trailing comma would corrupt category detection).
  const basePart = normalized.substring(0, splitPoint).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const exceptionsPart = normalized.substring(splitPoint + usedExclusion.length).trim();

  const command = inferCommandFromSegment(basePart);
  if (!command) {
    return { type: 'failure', message: 'No se pudo entender la acción principal ("apaga" o "prende").' };
  }

  const allDevices = await scope.getAuthorizedDevices(userId);
  const allRooms = await scope.getAuthorizedRooms(userId);

  // Determine the base scope: bare "todo"/"todos" -> every controllable device;
  // a recognized light synonym -> lights only; anything else is treated as a free
  // category word (e.g. "dicroicos") matched generically against real device
  // names/vocabulary in this home, never a hardcoded list.
  const baseCategory = extractCategoryWord(basePart);
  const isLightsOnly = LIGHT_SYNONYMS_REGEX.test(basePart);

  let baseScopeDevices: Device[];
  if (!baseCategory || BULK_WORDS.has(baseCategory)) {
    baseScopeDevices = allDevices.filter(d => scopeFilter.isControllableForBulk(d, command, 'all'));
  } else if (isLightsOnly) {
    baseScopeDevices = allDevices.filter(d => scopeFilter.isControllableForBulk(d, command, 'lights'));
  } else {
    const vocabulary = buildVocabulary(allDevices.map(d => d.name));
    const correctedCategory = correctAgainstVocabulary(baseCategory, vocabulary);
    baseScopeDevices = allDevices.filter(d =>
      scopeFilter.isControllableForBulk(d, command, 'all') &&
      categoryMatchesDeviceName(correctedCategory, d.name)
    );
  }

  if (baseScopeDevices.length === 0) {
    return { type: 'failure', message: `No encontré "${baseCategory || 'todo'}" para ejecutar esa acción.` };
  }

  // Resolve each exception term (room, device, or category) into excluded device IDs.
  const exceptionTerms = exceptionsPart.split(EXCEPTION_SPLIT_REGEX).map(s => s.trim()).filter(Boolean);
  if (exceptionTerms.length === 0) {
    return { type: 'failure', message: `No pude encontrar qué significa "${exceptionsPart}".` };
  }

  const vocabulary = buildVocabulary([...allDevices.map(d => d.name), ...allRooms.map(r => r.name)]);
  const excludedDeviceIds = new Set<string>();

  for (const term of exceptionTerms) {
    const corrected = correctAgainstVocabulary(term, vocabulary);

    const roomMatch = allRooms.find(r => {
      const roomName = normalizeText(r.name);
      return roomName.includes(corrected) || corrected.includes(roomName);
    });
    if (roomMatch) {
      for (const d of allDevices) if (d.roomId === roomMatch.id) excludedDeviceIds.add(d.id);
      continue;
    }

    // Compare both the raw phrase and an article/preposition-stripped version:
    // "la luz de cocina" must match a device literally named "Luz de Cocina"
    // (raw substring) as well as one named just "Luz Cocina" (stripped tokens),
    // since real installs rarely keep filler words in device names.
    const strippedCorrected = stripArticlesAndBulkWords(corrected);
    const deviceMatches = allDevices.filter(d => {
      const deviceName = normalizeText(d.name);
      const strippedDeviceName = stripArticlesAndBulkWords(deviceName);
      return deviceName === corrected || deviceName.includes(corrected) || corrected.includes(deviceName) ||
        strippedDeviceName === strippedCorrected || strippedDeviceName.includes(strippedCorrected) || strippedCorrected.includes(strippedDeviceName) ||
        categoryMatchesDeviceName(corrected, d.name);
    });
    if (deviceMatches.length > 0) {
      for (const d of deviceMatches) excludedDeviceIds.add(d.id);
      continue;
    }

    // An exception term we can't identify must abort the whole command rather
    // than be silently dropped — otherwise "menos X" could turn into "todo"
    // if X fails to resolve, which is the opposite of what was asked.
    return { type: 'failure', message: `No pude encontrar qué significa "${term}".` };
  }

  const actions: MultiCommandAction[] = [];
  for (const d of baseScopeDevices) {
    if (excludedDeviceIds.has(d.id)) continue;
    actions.push({ deviceId: d.id, command, targetName: d.name });
  }

  if (actions.length === 0) {
    return { type: 'failure', message: 'No se encontraron dispositivos para ejecutar esa acción.' };
  }

  return {
    type: 'success',
    intent: {
      type: 'multi_command',
      prompt: originalPrompt,
      actions,
      requiresConfirmation: true
    }
  };
}
