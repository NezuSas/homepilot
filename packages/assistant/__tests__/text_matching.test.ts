import {
  stripDiacritics,
  normalizeText,
  levenshteinDistance,
  diceCoefficient,
  wordSimilarity,
  correctAgainstVocabulary,
  buildVocabulary
} from '../application/textMatching';

describe('textMatching', () => {
  it('strips diacritics', () => {
    expect(stripDiacritics('café')).toBe('cafe');
    expect(normalizeText('¿Cómo estás?')).toBe('como estas');
  });

  it('computes levenshtein distance', () => {
    expect(levenshteinDistance('cocina', 'cocina')).toBe(0);
    expect(levenshteinDistance('cosina', 'cocina')).toBe(1);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('computes dice coefficient for near-identical words higher than for unrelated ones', () => {
    const close = diceCoefficient('cosina', 'cocina');
    const far = diceCoefficient('cosina', 'persiana');
    expect(close).toBeGreaterThanOrEqual(0.6);
    expect(close).toBeGreaterThan(far);
  });

  it('rates known typos as highly similar without any hardcoded dictionary', () => {
    expect(wordSimilarity('cosina', 'cocina')).toBeGreaterThanOrEqual(0.72);
    expect(wordSimilarity('luy', 'luz')).toBeGreaterThanOrEqual(0.6);
    expect(wordSimilarity('abitacion', 'habitacion')).toBeGreaterThanOrEqual(0.72);
  });

  it('corrects a misspelling against an arbitrary vocabulary — not a static dictionary', () => {
    // "cocina" was never hardcoded anywhere; it only exists because it appears
    // in this specific home's device names.
    const vocabulary = buildVocabulary(['Luz Cocina', 'Enchufe Sala']);
    expect(correctAgainstVocabulary('luz cosina', vocabulary)).toBe('luz cocina');
  });

  it('leaves words alone when no close vocabulary match exists', () => {
    const vocabulary = buildVocabulary(['Luz Cocina']);
    expect(correctAgainstVocabulary('television garage', vocabulary)).toBe('television garage');
  });

  it('never corrects a word that is already exactly in the vocabulary', () => {
    const vocabulary = buildVocabulary(['Luz Cocina', 'Foco Sala']);
    expect(correctAgainstVocabulary('foco sala', vocabulary)).toBe('foco sala');
  });

  it('generalizes to misspellings never seen before (proves no hardcoded phrase list is needed)', () => {
    const vocabulary = buildVocabulary(['Persiana Comedor', 'Ventilador Techo']);
    expect(correctAgainstVocabulary('persana comedor', vocabulary)).toBe('persiana comedor');
    expect(correctAgainstVocabulary('bentilador techo', vocabulary)).toBe('ventilador techo');
  });

  it('does not auto-correct very short/ambiguous words at the default threshold', () => {
    // "sal" is genuinely equidistant from "sala" and plausible unrelated short words —
    // this safety margin is what keeps the fast path from silently guessing on short
    // tokens; callers should fall back to an explicit "did you mean?" confirmation instead.
    const vocabulary = buildVocabulary(['Luz Sala']);
    expect(correctAgainstVocabulary('sal', vocabulary)).toBe('sal');
  });
  it('normalizes speech-like phonetic and plural variants only from the supplied inventory', () => {
    const vocabulary = buildVocabulary(['Dicroicos Trabajo', 'Led Trabajo']);
    expect(correctAgainstVocabulary('croikos trabajos', vocabulary)).toBe('dicroicos trabajo');
    expect(correctAgainstVocabulary('decróicos trabajo', vocabulary)).toBe('dicroicos trabajo');
  });

});
