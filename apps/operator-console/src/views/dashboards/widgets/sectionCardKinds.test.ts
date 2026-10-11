import { getCatalogDescriptionKey, getCatalogLabelKey, getDefaultIcon } from './sectionCardLabels';
import { createId, normalizeCards } from './sectionCardNormalization';
import { normalizeMediaVariant, normalizeSensorScale, normalizeSensorVisualStyle } from './sectionCardTypes';
import { getEffectiveCardSpan, getRecommendedSectionHeight, getSpanClass, isClockKind, normalizeKind } from './sectionCardKinds';

describe('section card topic modules', () => {
  it('normalizes legacy clock kinds and clamps spans', () => {
    expect(normalizeKind('clock')).toBe('clock_digital');
    expect(isClockKind('clock')).toBe(true);
    expect(getEffectiveCardSpan('media', 'small')).toBe('full');
    expect(getEffectiveCardSpan('cover', 'small')).toBe('medium');
    expect(getEffectiveCardSpan('light', 'small')).toBe('small');
    expect(getSpanClass('small')).toBe('col-span-6 sm:col-span-3');
  });

  it('estimates the section height from the card spans', () => {
    expect(getRecommendedSectionHeight(10, [])).toBe(3);
    expect(getRecommendedSectionHeight(10, [{ id: 'a', kind: 'camera', title: '', span: 'full' }])).toBe(5);
  });

  it('maps every kind to label, description and icon fallbacks', () => {
    expect(getCatalogLabelKey('info_weather')).toBe('dashboard.editor.sections.section_card_information');
    expect(getCatalogDescriptionKey('clock')).toBe('dashboard.editor.sections.section_card_clock_desc');
    expect(getDefaultIcon('info_time')).toBe(getDefaultIcon('clock_minimal'));
  });

  it('drops obsolete cards and generates ids for anonymous ones', () => {
    const cards = normalizeCards({ cards: [{ kind: 'room' }, { kind: 'system' }, { kind: 'scene' }, { kind: 'light', title: ' ' }] });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: 'light', title: '', hidden: false });
    expect(cards[0].id).toMatch(/^section-card-/);
    expect(createId()).not.toBe(createId());
  });

  it('keeps the primitive normalizers strict', () => {
    expect(normalizeMediaVariant('classic')).toBe('classic');
    expect(normalizeMediaVariant('other')).toBe('premium');
    expect(normalizeSensorVisualStyle('nope')).toBe('gauge');
    expect(normalizeSensorScale({ min: 0, max: 1 })).toEqual({ min: 0, max: 1 });
  });
});
