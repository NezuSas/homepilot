import {
  cardKinds,
  createId,
  getCatalogDescriptionKey,
  getCatalogLabelKey,
  getClockKindLabelKey,
  getClockStyleForKind,
  getDefaultIcon,
  getDefaultSpan,
  getSpanClass,
  getWidgetType,
  isBindableKind,
  getRecommendedSectionHeight,
  normalizeCards,
  isClockKind,
  normalizeKind,
} from '../sectionCardCatalog';

describe('Feature: catálogo de tarjetas de sección', () => {
  it('Scenario: Given un tipo legado de reloj When se normaliza Then usa el reloj digital compatible', () => {
    expect(normalizeKind('clock')).toBe('clock_digital');
    expect(isClockKind('clock')).toBe(true);
    expect(getClockStyleForKind('clock')).toBe('analog-classic');
  });

  it('Scenario: Given tarjetas configurables When se calcula su layout Then conserva tamaños y bindings compatibles', () => {
    expect(getDefaultSpan('light')).toBe('small');
    expect(getDefaultSpan('camera')).toBe('full');
    expect(getSpanClass('medium')).toBe('col-span-6');
    expect(isBindableKind('clock_digital')).toBe(false);
    expect(getWidgetType('action')).toBe('action_button');
    expect(isBindableKind('action')).toBe(true);
    expect(getDefaultIcon('sensor')).toBe('mdi:gauge');
  });
  it('Scenario: Given every supported catalog kind When resolving presentation metadata Then it preserves each explicit mapping', () => {
    expect(getCatalogLabelKey('light')).toBe('dashboard.editor.sections.section_card_light');
    expect(getCatalogLabelKey('cover')).toBe('dashboard.editor.sections.section_card_cover');
    expect(getCatalogLabelKey('camera')).toBe('dashboard.editor.sections.section_card_camera');
    expect(getCatalogLabelKey('sensor')).toBe('dashboard.editor.sections.section_card_sensor');
    expect(getCatalogLabelKey('media')).toBe('dashboard.editor.sections.section_card_media');
    expect(getCatalogLabelKey('action')).toBe('dashboard.editor.sections.section_card_action');
    expect(getCatalogLabelKey('energy')).toBe('dashboard.editor.sections.section_card_energy');
    expect(getCatalogLabelKey('assistant')).toBe('dashboard.editor.sections.section_card_assistant');
    expect(getCatalogDescriptionKey('device')).toBe('dashboard.editor.sections.section_card_device_desc');
    expect(getCatalogDescriptionKey('clock')).toBe('dashboard.editor.sections.section_card_clock_desc');
    expect(getClockKindLabelKey('clock_analog')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getClockStyleForKind('clock_premium')).toBe('analog-classic');
    expect(getClockStyleForKind('clock_minimal')).toBe('analog-classic');
    expect(getWidgetType('energy')).toBe('energy_snapshot');
    expect(getWidgetType('assistant')).toBe('assistant_insight');
    expect(getWidgetType('clock_minimal')).toBe('clock_display');
    expect(getDefaultIcon('cover')).toBe('mdi:blinds');
    expect(getDefaultIcon('camera')).toBe('mdi:camera');
    expect(getDefaultIcon('media')).toBe('mdi:music');
    expect(getDefaultIcon('energy')).toBe('mdi:flash');
    expect(getDefaultIcon('assistant')).toBe('mdi:robot');
  });

  it('Scenario: Given legacy, incomplete and clock cards When normalizing them Then unsupported cards are removed and safe defaults are used', () => {
    const cards = normalizeCards({
      cards: [
        { kind: 'system', title: 'Legacy system card' },
        { id: 'light-1', kind: 'light', title: 'Light', span: 'medium', icon: 'Lightbulb', order: 4 },
        { id: 'clock-1', kind: 'clock', title: 'Clock', span: 'small' },
        { id: 'sensor-1', kind: 'sensor', title: 'Sensor', span: 'invalid' },
      ],
    });

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ id: 'light-1', kind: 'light', span: 'medium', icon: 'Lightbulb' });
    expect(cards[0]).not.toHaveProperty('order');
    expect(cards[1]).toMatchObject({ id: 'clock-1', kind: 'clock_digital', span: 'full', widgetType: 'clock_display', icon: getDefaultIcon('clock') });
    expect(cards[2]).toMatchObject({ id: 'sensor-1', kind: 'sensor', span: 'medium', widgetType: 'device_control', icon: getDefaultIcon('sensor') });
  });

  it('Scenario: Given obsolete room and scene cards When normalizing Then they are removed from the dashboard', () => {
    expect(normalizeCards({
      cards: [
        { id: 'room-1', kind: 'room', title: 'Legacy room' },
        { id: 'scene-1', kind: 'scene', title: 'Legacy scene' },
      ],
    })).toEqual([]);
  });

  it('Scenario: Given a legacy manual card height When normalizing Then measured masonry layout ignores it', () => {
    const [card] = normalizeCards({
      cards: [{ id: 'legacy-light', kind: 'light', title: 'Light', rowSpan: 6 }],
    });

    expect(card).toMatchObject({ id: 'legacy-light', kind: 'light' });
    expect(card).not.toHaveProperty('rowSpan');
  });
  it('Scenario: Given section cards of different spans When calculating the layout Then it returns the compact recommended height', () => {
    expect(getRecommendedSectionHeight(99, [])).toBe(3);
    expect(getRecommendedSectionHeight(1, [
      { id: 'small', kind: 'light', title: 'Small', span: 'small' },
      { id: 'medium', kind: 'sensor', title: 'Medium', span: 'medium' },
      { id: 'full', kind: 'camera', title: 'Full', span: 'full' },
    ])).toBe(6);
    expect(getSpanClass('full')).toBe('col-span-full');
    expect(getSpanClass('small')).toBe('col-span-6 sm:col-span-3');
  });
  it('Scenario: Given the full catalog When resolving metadata Then all clock variants and defaults remain explicit', () => {
    expect(cardKinds).toEqual(expect.arrayContaining(['light', 'cover', 'camera', 'sensor', 'media', 'clock_premium']));
    expect(cardKinds.filter(isClockKind)).toEqual(['clock_premium']);
    expect(cardKinds).not.toEqual(expect.arrayContaining(['room', 'scene', 'action']));
    expect(getCatalogLabelKey('clock_analog')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getCatalogLabelKey('clock_premium')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getCatalogLabelKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getCatalogDescriptionKey('clock_analog')).toBe('dashboard.editor.sections.section_card_clock_desc');
    expect(getCatalogDescriptionKey('clock_premium')).toBe('dashboard.editor.sections.section_card_clock_desc');
    expect(getCatalogDescriptionKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock_desc');
    expect(getDefaultSpan('device')).toBe('medium');
    expect(getDefaultSpan('action')).toBe('medium');
    expect(getDefaultSpan('cover')).toBe('medium');
    expect(getWidgetType('light')).toBe('device_control');
    expect(getDefaultIcon('clock_premium')).toBe('mdi:clock-outline');
    expect(getDefaultIcon('device')).toBe('mdi:power');
    expect(getClockKindLabelKey('clock_digital')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getClockKindLabelKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getClockKindLabelKey('light')).toBe('dashboard.editor.sections.section_card_clock');
    expect(getClockStyleForKind('light')).toBe('analog-classic');
  });

  it('Scenario: Given malformed persisted cards When normalizing Then generated ids and defaults keep the catalog safe', () => {
    jest.spyOn(Date, 'now').mockReturnValue(123);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      expect(createId()).toBe('section-card-123-i');
      const cards = normalizeCards({
        cards: [
          { id: '   ', kind: 'device', title: '   ', description: 3, entityId: 4, entityName: 5, icon: ' ', order: 'first' },
          { kind: 'assistant', title: 'Helper' },
        ],
      });
      expect(cards[0]).toMatchObject({
        id: 'section-card-123-i',
        kind: 'device',
        title: '',
        description: '',
        entityId: undefined,
        entityName: undefined,
        span: 'medium',
        icon: getDefaultIcon('device'),
      });
      expect(cards[1]).toMatchObject({ kind: 'assistant', span: 'medium', widgetType: 'assistant_insight' });
      expect(normalizeCards({ cards: 'not-an-array' as never })).toEqual([]);
    } finally {
      jest.restoreAllMocks();
    }
  });
});
