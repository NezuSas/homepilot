export const NEZU_WAKE_NAMES = [
  'nezu',
  'nesu',
  'ne su',
  'nezo',
  'neso'
] as const;

const NEZU_WAKE_PREFIXES = ['ok', 'okay', 'okey', 'okei'] as const;

export const NEZU_WAKE_PHRASES: readonly string[] = NEZU_WAKE_PREFIXES
  .flatMap(prefix => NEZU_WAKE_NAMES.map(name => `${prefix} ${name}`))
  .sort((left, right) => right.length - left.length);

export function normalizeNezuWakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractNezuWakeCommand(text: string): { activated: boolean; command: string } {
  const normalized = normalizeNezuWakeText(text);

  for (const phrase of NEZU_WAKE_PHRASES) {
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
  if (!NEZU_WAKE_PREFIXES.some(prefix => prefix === tokens[0])) {
    return { activated: false, command: '' };
  }

  const availableTokenCount = tokens.length - 1;
  let bestMatch: { consumedTokens: number; distance: number; ratio: number } | null = null;

  for (let consumedTokens = 1; consumedTokens <= Math.min(2, availableTokenCount); consumedTokens += 1) {
    const candidate = tokens.slice(1, 1 + consumedTokens).join('');
    if (candidate.length < 3 || candidate.length > 5) continue;

    for (const wakeName of NEZU_WAKE_NAMES) {
      const canonical = wakeName.replace(/\s+/g, '');
      const distance = levenshteinDistance(candidate, canonical);
      const ratio = distance / Math.max(candidate.length, canonical.length);

      if (distance > 1 || ratio > 0.25) continue;
      if (!bestMatch || ratio < bestMatch.ratio || (ratio === bestMatch.ratio && distance < bestMatch.distance)) {
        bestMatch = { consumedTokens, distance, ratio };
      }
    }
  }

  if (!bestMatch) {
    return { activated: false, command: '' };
  }

  return {
    activated: true,
    command: tokens.slice(1 + bestMatch.consumedTokens).join(' ')
  };
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
