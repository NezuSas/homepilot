export const HOME_PILOT_WAKE_NAMES = [
  'homepilot',
  'home pilot',
  'home pylot',
  'home paylot',
  'pome pilote',
  'pome pilot',
  'hombalot',
  'han pilot',
  'hombilot',
  'hambailot',
  'hambailo',
  'compa y lot',
  'jompailot',
  'jompilot',
  'jom pailot',
  'jom paylot',
  'hom pailot',
  'jon pailot',
  'jonpailot',
  'jonpilot',
  'home pailot',
  'hom pilot',
  'hompilot',
  'jom pilot',
  'jon pilot',
  'on pailot',
  'onpailot',
  'onpilot',
  'on pilot',
  'om pailot',
  'ompailot',
  'ompilot',
  'om pilot'
] as const;

const HOME_PILOT_WAKE_PREFIXES = ['ok', 'okay', 'okey', 'oye', 'hey', 'ei', 'hola'] as const;

export const HOME_PILOT_WAKE_PHRASES: readonly string[] = [
  ...HOME_PILOT_WAKE_PREFIXES.flatMap(prefix =>
    HOME_PILOT_WAKE_NAMES.map(name => `${prefix} ${name}`)
  ),
  ...HOME_PILOT_WAKE_NAMES
].sort((left, right) => right.length - left.length);

export function normalizeHomePilotWakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractHomePilotWakeCommand(text: string): { activated: boolean; command: string } {
  const normalized = normalizeHomePilotWakeText(text);

  for (const phrase of HOME_PILOT_WAKE_PHRASES) {
    if (normalized === phrase) {
      return { activated: true, command: '' };
    }

    if (normalized.startsWith(`${phrase} `)) {
      return {
        activated: true,
        command: normalized.slice(phrase.length).trim()
      };
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const firstTokenIsPrefix = HOME_PILOT_WAKE_PREFIXES.some(prefix => prefix === tokens[0]);
  const wakeStartIndex = firstTokenIsPrefix ? 1 : 0;
  const availableTokenCount = tokens.length - wakeStartIndex;
  let bestMatch: { consumedTokens: number; distance: number; ratio: number } | null = null;

  for (let consumedTokens = 1; consumedTokens <= Math.min(3, availableTokenCount); consumedTokens += 1) {
    const candidateTokens = tokens.slice(wakeStartIndex, wakeStartIndex + consumedTokens);
    if (['el', 'la', 'un', 'una'].includes(candidateTokens[0])) continue;
    const candidate = candidateTokens.join('');
    if (candidate.length < 6) continue;

    for (const wakeName of HOME_PILOT_WAKE_NAMES) {
      const canonical = wakeName.replace(/\s+/g, '');
      const distance = levenshteinDistance(candidate, canonical);
      const ratio = distance / Math.max(candidate.length, canonical.length);
      const maximumDistance = canonical.length >= 10 ? 3 : 2;

      if (distance > maximumDistance || ratio > 0.25) continue;
      if (!bestMatch || ratio < bestMatch.ratio || (ratio === bestMatch.ratio && distance < bestMatch.distance)) {
        bestMatch = { consumedTokens, distance, ratio };
      }
    }
  }

  if (bestMatch) {
    return {
      activated: true,
      command: tokens.slice(wakeStartIndex + bestMatch.consumedTokens).join(' ')
    };
  }

  return { activated: false, command: '' };
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}
