import {
  cardKinds,
  catalogCategories,
  clockCardOptions,
  getCatalogCategory,
  getCatalogDescriptionKey,
  getCatalogLabelKey,
  getClockKindLabelKey,
  getClockStyleForKind,
  getDefaultIcon,
  getDefaultSpan,
  getRecommendedSectionHeight,
  getSpanClass,
  getWidgetType,
  isBindableKind,
  isClockKind,
  MAX_MANUAL_ROW_SPAN,
  normalizeCards,
  normalizeKind,
} from './sectionCardCatalog';

describe('section card catalog contracts', () => {
  it('normalizes legacy cards and derives stable defaults for widget configuration', () => {
    const cards = normalizeCards({
      cards: [
        { id: 'legacy-clock', kind: 'clock', title: 'Reloj', span: 'small' },
        { kind: 'camera', entityId: 'camera.gate', span: 'invalid' },
        { kind: 'system', title: 'Removed legacy card' },
      ],
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual(expect.objectContaining({ id: 'legacy-clock', kind: 'clock_digital', span: 'full', widgetType: 'clock_display', icon: 'Clock' }));
    expect(cards[1]).toEqual(expect.objectContaining({ kind: 'camera', entityId: 'camera.gate', span: 'full', widgetType: 'device_control', icon: 'Camera' }));
  });

  it('clamps a manual card rowSpan to 1..MAX_MANUAL_ROW_SPAN and ignores it for clock cards', () => {
    const cards = normalizeCards({
      cards: [
        { kind: 'sensor', rowSpan: 999 },
        { kind: 'sensor', rowSpan: 0 },
        { kind: 'sensor' },
        { kind: 'clock_digital', rowSpan: 3 },
      ],
    });

    expect(cards[0].rowSpan).toBe(MAX_MANUAL_ROW_SPAN);
    expect(cards[1].rowSpan).toBeUndefined();
    expect(cards[2].rowSpan).toBeUndefined();
    expect(cards[3].rowSpan).toBeUndefined();
  });

  it('maps every supported card kind to its visual catalog, binding, and layout contracts', () => {
    expect(cardKinds).toContain('clock_premium');
    expect(clockCardOptions.map((option) => option.kind)).toEqual(expect.arrayContaining(['clock_digital', 'clock_analog', 'clock_premium', 'clock_minimal']));
    expect(normalizeKind('clock')).toBe('clock_digital');
    expect(isClockKind('clock_premium')).toBe(true);
    expect(isBindableKind('assistant')).toBe(false);
    expect(isBindableKind('scene')).toBe(true);
    expect(getDefaultSpan('light')).toBe('small');
    expect(getDefaultSpan('media')).toBe('medium');
    expect(getDefaultSpan('camera')).toBe('full');
    expect(getDefaultIcon('assistant')).toBe('Bot');
    expect(getWidgetType('energy')).toBe('energy_snapshot');
    expect(getCatalogLabelKey('cover')).toBe('dashboard.editor.sections.section_card_cover');
    expect(getCatalogDescriptionKey('sensor')).toBe('dashboard.editor.sections.section_card_sensor_desc');
    expect(getSpanClass('medium')).toBe('col-span-2');
    expect(getClockKindLabelKey('clock_minimal')).toBe('dashboard.editor.sections.clock_style_minimal');
    expect(getClockStyleForKind('clock_premium')).toBe('analog-classic');
  });

  it('estimates section height from card spans while preserving the empty minimum', () => {
    expect(getRecommendedSectionHeight(99, [])).toBe(3);
    const cards = normalizeCards({ cards: [
      { id: 'one', kind: 'full', span: 'full' },
      { id: 'two', kind: 'light', span: 'small' },
      { id: 'three', kind: 'media', span: 'medium' },
    ] });

    expect(getRecommendedSectionHeight(1, cards)).toBeGreaterThanOrEqual(4);
  });

  it('groups every catalog kind into one of the known add-card categories', () => {
    expect(getCatalogCategory('sensor')).toBe('info');
    expect(getCatalogCategory('room')).toBe('info');
    expect(getCatalogCategory('scene')).toBe('automation');
    expect(getCatalogCategory('light')).toBe('control');
    expect(getCatalogCategory('clock_premium')).toBe('clock');

    const categoryKeys = catalogCategories.map((category) => category.key);
    for (const kind of cardKinds) {
      expect(categoryKeys).toContain(getCatalogCategory(kind));
    }
  });
});