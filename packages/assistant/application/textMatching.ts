/**
 * Generic text-matching utilities shared across the assistant's deterministic
 * fast paths.
 *
 * Deliberately NOT a hardcoded typo dictionary: `correctAgainstVocabulary`
 * corrects a misspelled word against whatever vocabulary the caller supplies
 * (e.g. the actual device/room names in this specific home) using edit
 * distance and bigram overlap, instead of a fixed list that has to be
 * extended by hand every time someone speaks a new misspelling. A dictionary
 * only ever covers the typos an engineer thought to add; this covers any
 * misspelling of any word that is actually present in the home.
 */

export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lowercase, diacritic-free, punctuation-stripped, single-spaced. */
export function normalizeText(text: string): string {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance, single-row rolling array. */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) prevRow[j] = j;

  for (let i = 1; i <= m; i += 1) {
    const currRow = new Array<number>(n + 1);
    currRow[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currRow;
  }
  return prevRow[n];
}

function characterBigrams(s: string): string[] {
  if (s.length < 2) return [s];
  const grams: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) grams.push(s.slice(i, i + 2));
  return grams;
}

/** Dice's coefficient over character bigrams: 2 * |intersection| / (|A| + |B|). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigramsA = characterBigrams(a);
  const bigramsB = characterBigrams(b);
  const remaining = new Map<string, number>();
  for (const bg of bigramsB) remaining.set(bg, (remaining.get(bg) || 0) + 1);

  let intersection = 0;
  for (const bg of bigramsA) {
    const count = remaining.get(bg) || 0;
    if (count > 0) {
      intersection += 1;
      remaining.set(bg, count - 1);
    }
  }
  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

/**
 * Combined 0-1 word similarity: the better of bigram overlap and normalized
 * edit-distance. Dice tends to be more forgiving for transpositions/typos in
 * the middle of a word; Levenshtein ratio catches short words where bigram
 * overlap is too coarse.
 */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const dice = diceCoefficient(a, b);
  const maxLen = Math.max(a.length, b.length);
  const levenshteinRatio = maxLen === 0 ? 1 : 1 - levenshteinDistance(a, b) / maxLen;
  return Math.max(dice, levenshteinRatio);
}

/**
 * Produces a conservative Spanish-oriented phonetic key for speech recognition
 * variations. It does not encode device names: callers still compare only against
 * the authorized inventory vocabulary.
 */
function spanishPhoneticKey(value: string): string {
  return normalizeText(value)
    .replace(/qu/g, 'k')
    .replace(/[ckq]/g, 'k')
    .replace(/v/g, 'b')
    .replace(/[zs]/g, 's')
    .replace(/h/g, '')
    .replace(/ll/g, 'y')
    .replace(/([aeiou])\1+/g, '$1');
}

function phoneticInventoryMatch(input: string, candidate: string): boolean {
  const inputKey = spanishPhoneticKey(input);
  const candidateKey = spanishPhoneticKey(candidate);
  const shortest = Math.min(inputKey.length, candidateKey.length);
  const lengthDelta = Math.abs(inputKey.length - candidateKey.length);

  const phoneticSimilarity = wordSimilarity(inputKey, candidateKey);

  return shortest >= 5
    && lengthDelta <= 3
    && (
      inputKey.endsWith(candidateKey)
      || candidateKey.endsWith(inputKey)
      || phoneticSimilarity >= 0.8
    );
}

function singularCandidate(token: string): string | null {
  if (token.length < 5) return null;
  if (token.endsWith('es')) return token.slice(0, -2);
  if (token.endsWith('s')) return token.slice(0, -1);
  return null;
}

/**
 * Corrects each word in `text` against a known vocabulary instead of a static
 * typo dictionary. A word is substituted only when it isn't already in the
 * vocabulary and a close match is found at or above `threshold`.
 */
export function correctAgainstVocabulary(
  text: string,
  vocabulary: ReadonlySet<string>,
  threshold: number = 0.8
): string {
  if (vocabulary.size === 0) return text;

  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token.length < 3 || vocabulary.has(token)) return token;

      const singular = singularCandidate(token);
      if (singular && vocabulary.has(singular)) return singular;

      let bestWord = token;
      let bestScore = threshold;
      for (const word of vocabulary) {
        if (Math.abs(word.length - token.length) > 3) continue; // cheap prefilter
        const score = wordSimilarity(token, word);
        if (score > bestScore || (score === bestScore && phoneticInventoryMatch(token, word))) {
          bestScore = score;
          bestWord = word;
        }
      }

      if (bestWord !== token) return bestWord;

      const phoneticMatch = Array.from(vocabulary).find((word) => phoneticInventoryMatch(token, word));
      return phoneticMatch ?? token;
    })
    .join(' ');
}

/** Builds a word vocabulary (e.g. for typo correction) from a list of names. */
export function buildVocabulary(names: readonly string[], stopwords?: ReadonlySet<string>): Set<string> {
  const vocabulary = new Set<string>();
  for (const name of names) {
    for (const token of normalizeText(name).split(' ')) {
      if (token && !stopwords?.has(token)) vocabulary.add(token);
    }
  }
  return vocabulary;
}
