import {
  canUseCompactSpan,
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
  getEffectiveCardSpan,
  getRecommendedSectionHeight,
  getSpanClass,
  getWidgetType,
  isBindableKind,
  isClockKind,
  normalizeCards,
  normalizeKind,
  normalizeSensorScale,
} from './sectionCardCatalog';

describe('Sensor fixed scale (AC42)', () => {
  it.each([undefined, false, true])('preserves decimal opt-in %s, defaults to integers', sensorDecimals => {
    const [card] = normalizeCards({ cards: [{ id: 's', kind: 'sensor', sensorDecimals }] });
    expect(card.sensorDecimals === true).toBe(sensorDecimals === true);
    expect(normalizeCards({ cards: [card] })[0].sensorDecimals === true).toBe(sensorDecimals === true);
  });
  it.each([{ min: 0, max: 100 }, { min: -20, max: 40 }])('retains valid scale through card normalization', sensorScale => {
    const [card] = normalizeCards({ cards: [{ id: 'sensor', kind: 'sensor', sensorScale }] });
    expect(card.sensorScale).toEqual(sensorScale);
    expect(normalizeCards({ cards: [card] })[0].sensorScale).toEqual(sensorScale);
  });
  it.each([undefined, { min: 1 }, { min: 2, max: 1 }, { min: 1, max: 1 }, { min: NaN, max: 4 }, { min: 0, max: Infinity }])('ignores invalid/historical scales %j', scale => {
    expect(normalizeSensorScale(scale)).toBeUndefined();
  });
});
import { executeDeviceActionTarget, getDeviceActionExecuteUrl, isDeviceActionEntityId,
  normalizeAssignableDisplayAction, parseDeviceActionEntityId, toDeviceActionEntityId } from './sectionCardAssignments';

jest.mock('../../../config', () => ({ API_BASE_URL: '' }));

describe('section card catalog contracts', () => {
  it('offers one independent information card with three persistent read-only presentations', () => {
    expect(cardKinds.filter(kind => kind.startsWith('info_'))).toEqual(['info_time']);
    for (const kind of ['info_time', 'info_weather', 'info_sensor'] as const) {
      expect(getCatalogCategory(kind)).toBe('info');
      const [card] = normalizeCards({ cards: [{ id: 'label', kind, entityId: kind === 'info_sensor' ? 'sensor' : undefined, gridOptions: { columns: 2, rows: 2 } }] });
      expect(normalizeCards(JSON.parse(JSON.stringify({ cards: [card] })))[0]).toEqual(card);
    }
    expect(isBindableKind('info_sensor')).toBe(true);
    expect(isBindableKind('info_time')).toBe(false);
  });
  it('persists and parses a validated device-action target without ambiguous splits', () => {
    const target = toDeviceActionEntityId('device-123', 'hp_navigate_home');
    expect(target).toBe('device-action:device-123:hp_navigate_home');
    expect(isDeviceActionEntityId(target)).toBe(true);
    expect(parseDeviceActionEntityId(target)).toEqual({ deviceId: 'device-123', actionKey: 'hp_navigate_home' });
    expect(getDeviceActionExecuteUrl(target)).toBe('/api/v1/devices/device-123/actions/hp_navigate_home/execute');
    expect(parseDeviceActionEntityId('device-action:device-123:hp_home:extra')).toBeNull();
    expect(() => toDeviceActionEntityId('device:123', 'hp_home')).toThrow('INVALID_DEVICE_ACTION_TARGET');
    expect(normalizeAssignableDisplayAction({ deviceId: 'device-123', actionKey: 'hp_home',
      displayName: 'Inicio', deviceName: 'Pizarra' })).not.toBeNull();
    expect(normalizeAssignableDisplayAction({ deviceId: 'device-123', actionKey: 'hp_home:bad',
      displayName: 'Inicio', deviceName: 'Pizarra' })).toBeNull();
  });

  it('uses only the action-key endpoint and rejects a revoked action without fallback', async () => {
    const target = toDeviceActionEntityId('device-123', 'hp_navigate_home');
    const request = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(executeDeviceActionTarget(target, request)).rejects.toThrow('DEVICE_ACTION_403');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/api/v1/devices/device-123/actions/hp_navigate_home/execute', { method: 'POST' });
  });

  it('uses the same Action Card target for a remote button without sending route details', async () => {
    const target = toDeviceActionEntityId('display-1', 'go_home');
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'display-1' }) });
    await executeDeviceActionTarget(target, request);
    expect(target).toBe('device-action:display-1:go_home');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/api/v1/devices/display-1/actions/go_home/execute', { method: 'POST' });
  });
  it('normalizes legacy cards and derives stable defaults for widget configuration', () => {
    const cards = normalizeCards({
      cards: [
        { id: 'legacy-clock', kind: 'clock', title: 'Reloj', span: 'small' },
        { kind: 'camera', entityId: 'camera.gate', span: 'invalid' },
        { kind: 'system', title: 'Removed legacy card' },
      ],
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual(expect.objectContaining({ id: 'legacy-clock', kind: 'clock_digital', span: 'full', widgetType: 'clock_display', icon: getDefaultIcon('clock') }));
    expect(cards[1]).toEqual(expect.objectContaining({ kind: 'camera', entityId: 'camera.gate', span: 'full', widgetType: 'device_control', icon: getDefaultIcon('camera') }));
  });

  it('normalizes legacy manual heights into measured masonry cards', () => {
    const cards = normalizeCards({
      cards: [
        { kind: 'sensor', rowSpan: 999 },
        { kind: 'sensor', rowSpan: 0 },
        { kind: 'clock_digital', rowSpan: 3 },
      ],
    });

    expect(cards).toHaveLength(3);
    expect(cards.every((card) => !Object.hasOwn(card, 'rowSpan'))).toBe(true);
  });

  it('round-trips historical clock card IDs without introducing persisted visual fields', () => {
    const historicalKinds = ['clock_digital', 'clock_analog', 'clock_premium', 'clock_minimal'] as const;
    const cards = normalizeCards({ cards: historicalKinds.map((kind, index) => ({ id: `clock-${index}`, kind, span: 'full' })) });
    expect(cards.map((card) => card.kind)).toEqual(historicalKinds);
    expect(JSON.parse(JSON.stringify(cards)).map((card: { kind: string }) => card.kind)).toEqual(historicalKinds);
    expect(cards.every((card) => !Object.hasOwn(card, 'design') && !Object.hasOwn(card, 'variant'))).toBe(true);
  });

  it('maps every supported card kind to its visual catalog, binding, and layout contracts', () => {
    expect(cardKinds).toContain('clock_premium');
    expect(clockCardOptions.map((option) => option.kind)).toEqual(['clock_premium']);
    expect(cardKinds.filter(isClockKind)).toEqual(['clock_premium']);
    expect(normalizeKind('clock')).toBe('clock_digital');
    expect(isClockKind('clock_premium')).toBe(true);
    expect(isBindableKind('assistant')).toBe(false);
    expect(isBindableKind('scene')).toBe(true);
    expect(getDefaultSpan('light')).toBe('small');
    expect(getDefaultSpan('action')).toBe('medium');
    expect(getDefaultSpan('device')).toBe('medium');
    expect(getDefaultSpan('media')).toBe('full');
    expect(getDefaultSpan('camera')).toBe('full');
    expect(getDefaultIcon('assistant')).toBe('mdi:robot');
    expect(getWidgetType('energy')).toBe('energy_snapshot');
    expect(getCatalogLabelKey('cover')).toBe('dashboard.editor.sections.section_card_cover');
    expect(getCatalogDescriptionKey('sensor')).toBe('dashboard.editor.sections.section_card_sensor_desc');
    expect(getSpanClass('medium')).toBe('col-span-6');
    expect(getClockKindLabelKey('clock_minimal')).toBe('dashboard.editor.sections.section_card_clock');
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
    expect(getCatalogCategory('light')).toBe('control');
    expect(getCatalogCategory('clock_premium')).toBe('clock');

    const categoryKeys = catalogCategories.map((category) => category.key);
    for (const kind of cardKinds) {
      expect(categoryKeys).toContain(getCatalogCategory(kind));
    }
  });

  it('reserves quarter width for light and activator tiles and full width for media players', () => {
    expect(canUseCompactSpan('light')).toBe(true);
    expect(canUseCompactSpan('device')).toBe(false);
    expect(canUseCompactSpan('action')).toBe(true);
    expect(canUseCompactSpan('cover')).toBe(false);
    expect(canUseCompactSpan('media')).toBe(false);
    expect(canUseCompactSpan('camera')).toBe(false);
    expect(canUseCompactSpan('sensor')).toBe(false);
    expect(canUseCompactSpan('room')).toBe(false);
    expect(canUseCompactSpan('scene')).toBe(false);

    expect(getEffectiveCardSpan('media', 'small')).toBe('full');
    expect(getEffectiveCardSpan('media', 'medium')).toBe('full');
    expect(getEffectiveCardSpan('media', 'full')).toBe('full');
    expect(getEffectiveCardSpan('camera', 'small')).toBe('medium');
    expect(getEffectiveCardSpan('sensor', 'small')).toBe('medium');
    expect(getEffectiveCardSpan('sensor', 'medium')).toBe('medium');
    expect(getEffectiveCardSpan('sensor', 'full')).toBe('medium');
    expect(getDefaultSpan('sensor')).toBe('medium');
    expect(normalizeCards({ cards: [{ kind: 'sensor', span: 'full' }] })[0].span).toBe('medium');
    expect(getEffectiveCardSpan('device', 'small')).toBe('medium');
    expect(getEffectiveCardSpan('action', 'small')).toBe('small');
    expect(getEffectiveCardSpan('cover', 'small')).toBe('medium');
    expect(getEffectiveCardSpan('light', 'small')).toBe('small');

    // A stale/imported card with a nonsensical stored span is corrected at
    // normalization time, not just at render time.
    const cards = normalizeCards({ cards: [
      { kind: 'media', span: 'small' },
      { kind: 'camera', span: 'small' },
      { kind: 'sensor', span: 'small' },
      { kind: 'device', span: 'small' },
      { kind: 'action', span: 'small' },
      { kind: 'cover', span: 'small' },
    ] });
    expect(cards[0].span).toBe('full');
    expect(cards[4].span).toBe('small');
    expect([cards[1], cards[2], cards[3], cards[5]].every((card) => card.span === 'medium')).toBe(true);
    expect(normalizeCards({ cards: [{ kind: 'media', span: 'medium' }] })[0].span).toBe('full');
    expect(cardKinds).not.toContain('action');
  });
});
