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
    expect(getClockStyleForKind('clock')).toBe('digital');
  });

  it('Scenario: Given tarjetas configurables When se calcula su layout Then conserva tamaños y bindings compatibles', () => {
    expect(getDefaultSpan('light')).toBe('small');
    expect(getDefaultSpan('camera')).toBe('full');
    expect(getSpanClass('medium')).toBe('col-span-1 sm:col-span-2');
    expect(isBindableKind('scene')).toBe(true);
    expect(isBindableKind('clock_digital')).toBe(false);
    expect(getWidgetType('scene')).toBe('scene_shortcut');
    expect(getDefaultIcon('sensor')).toBe('Gauge');
  });
  it('Scenario: Given every supported catalog kind When resolving presentation metadata Then it preserves each explicit mapping', () => {
    expect(getCatalogLabelKey('light')).toBe('dashboard.editor.sections.section_card_light');
    expect(getCatalogLabelKey('cover')).toBe('dashboard.editor.sections.section_card_cover');
    expect(getCatalogLabelKey('camera')).toBe('dashboard.editor.sections.section_card_camera');
    expect(getCatalogLabelKey('sensor')).toBe('dashboard.editor.sections.section_card_sensor');
    expect(getCatalogLabelKey('media')).toBe('dashboard.editor.sections.section_card_media');
    expect(getCatalogLabelKey('room')).toBe('dashboard.editor.sections.section_card_room');
    expect(getCatalogLabelKey('scene')).toBe('dashboard.editor.sections.section_card_scene');
    expect(getCatalogLabelKey('energy')).toBe('dashboard.editor.sections.section_card_energy');
    expect(getCatalogLabelKey('assistant')).toBe('dashboard.editor.sections.section_card_assistant');
    expect(getCatalogDescriptionKey('device')).toBe('dashboard.editor.sections.section_card_device_desc');
    expect(getCatalogDescriptionKey('clock')).toBe('dashboard.editor.sections.section_card_clock_digital_desc');
    expect(getClockKindLabelKey('clock_analog')).toBe('dashboard.editor.sections.clock_style_residential');
    expect(getClockStyleForKind('clock_premium')).toBe('analog-classic');
    expect(getClockStyleForKind('clock_minimal')).toBe('analog-minimal');
    expect(getWidgetType('room')).toBe('room_overview');
    expect(getWidgetType('energy')).toBe('energy_snapshot');
    expect(getWidgetType('assistant')).toBe('assistant_insight');
    expect(getWidgetType('clock_minimal')).toBe('clock_display');
    expect(getDefaultIcon('cover')).toBe('Blinds');
    expect(getDefaultIcon('camera')).toBe('Camera');
    expect(getDefaultIcon('media')).toBe('Music2');
    expect(getDefaultIcon('room')).toBe('Home');
    expect(getDefaultIcon('scene')).toBe('Sparkles');
    expect(getDefaultIcon('energy')).toBe('Zap');
    expect(getDefaultIcon('assistant')).toBe('Bot');
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
    expect(cards[0]).toMatchObject({ id: 'light-1', kind: 'light', span: 'medium', icon: 'Lightbulb', order: 4 });
    expect(cards[1]).toMatchObject({ id: 'clock-1', kind: 'clock_digital', span: 'full', widgetType: 'clock_display', icon: 'Clock' });
    expect(cards[2]).toMatchObject({ id: 'sensor-1', kind: 'sensor', span: 'medium', widgetType: 'device_control', icon: 'Gauge' });
  });

  it('Scenario: Given section cards of different spans When calculating the layout Then it returns the compact recommended height', () => {
    expect(getRecommendedSectionHeight(99, [])).toBe(3);
    expect(getRecommendedSectionHeight(1, [
      { id: 'small', kind: 'light', title: 'Small', span: 'small' },
      { id: 'medium', kind: 'sensor', title: 'Medium', span: 'medium' },
      { id: 'full', kind: 'camera', title: 'Full', span: 'full' },
    ])).toBe(6);
    expect(getSpanClass('full')).toBe('col-span-full');
    expect(getSpanClass('small')).toBe('col-span-1');
  });
  it('Scenario: Given the full catalog When resolving metadata Then all clock variants and defaults remain explicit', () => {
    expect(cardKinds).toEqual(expect.arrayContaining(['light', 'cover', 'camera', 'sensor', 'media', 'clock_premium', 'clock_minimal']));
    expect(getCatalogLabelKey('clock_analog')).toBe('dashboard.editor.sections.section_card_clock_analog');
    expect(getCatalogLabelKey('clock_premium')).toBe('dashboard.editor.sections.section_card_clock_premium');
    expect(getCatalogLabelKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock_minimal');
    expect(getCatalogDescriptionKey('clock_analog')).toBe('dashboard.editor.sections.section_card_clock_analog_desc');
    expect(getCatalogDescriptionKey('clock_premium')).toBe('dashboard.editor.sections.section_card_clock_premium_desc');
    expect(getCatalogDescriptionKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock_minimal_desc');
    expect(getDefaultSpan('device')).toBe('small');
    expect(getDefaultSpan('cover')).toBe('small');
    expect(getDefaultSpan('room')).toBe('medium');
    expect(getWidgetType('light')).toBe('device_control');
    expect(getDefaultIcon('clock_premium')).toBe('Clock');
    expect(getDefaultIcon('device')).toBe('Power');
    expect(getClockKindLabelKey('clock_digital')).toBe('dashboard.editor.sections.clock_style_digital');
    expect(getClockKindLabelKey('clock_minimal')).toBe('dashboard.editor.sections.clock_style_minimal');
    expect(getClockKindLabelKey('light')).toBe('dashboard.editor.sections.clock_style_premium');
    expect(getClockStyleForKind('light')).toBe('minimal');
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
        span: 'small',
        icon: 'Power',
        order: 0,
      });
      expect(cards[1]).toMatchObject({ kind: 'assistant', span: 'medium', widgetType: 'assistant_insight', order: 1 });
      expect(normalizeCards({ cards: 'not-an-array' as never })).toEqual([]);
    } finally {
      jest.restoreAllMocks();
    }
  });
});