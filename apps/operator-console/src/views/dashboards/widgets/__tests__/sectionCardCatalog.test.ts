import {
  getClockStyleForKind,
  getDefaultIcon,
  getDefaultSpan,
  getSpanClass,
  getWidgetType,
  isBindableKind,
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
});