import { renderToStaticMarkup } from 'react-dom/server';
import { SensorThermometer } from './SensorThermometer';
import { SensorLevelGauge } from './SensorLevelGauge';
import { SensorBatteryGauge } from './SensorBatteryGauge';
import { resolveSensorVisualStyle, SensorMetricCard } from './SensorMetricCard';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { normalizeCards } from './sectionCardCatalog';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('Sensor visualizers (AC45)', () => {
  for (const visualStyle of ['gauge', 'thermometer', 'level', 'battery'] as const) {
    it.each(['unavailable', 'unknown'])(visualStyle + ' keeps unavailable %s neutral in the real card', state => {
      const device: SnapshotDevice = { id: 's', homeId: 'h', roomId: null, name: 'Sensor', type: 'sensor', status: 'ASSIGNED',
        lastKnownState: { state, attributes: { unit_of_measurement: '%', device_class: 'battery' } } };
      const html = renderToStaticMarkup(<SensorMetricCard title="Sensor" visualStyle={visualStyle} device={device} />);
      expect(html).not.toContain('role="meter"');
      expect(html).not.toContain('data-level=');
      expect(html).toContain('—');
    });
  }
  it('shows charging only when provided, never from battery percentage', () => {
    const props = { value: 50, scale: { min: 0, max: 100, source: 'percentage' as const } };
    expect(renderToStaticMarkup(<SensorBatteryGauge {...props} />)).not.toContain('data-battery-charging');
    expect(renderToStaticMarkup(<SensorBatteryGauge {...props} charging />)).toContain('data-battery-charging');
  });
  it('distinguishes the liquid tank from the battery silhouette', () => {
    const props = { value: 50, scale: { min: 0, max: 100, source: 'percentage' as const } };
    const level = renderToStaticMarkup(<SensorLevelGauge {...props} />);
    const battery = renderToStaticMarkup(<SensorBatteryGauge {...props} />);
    expect(level).toContain('data-sensor-level-tank');
    expect(level).toContain('data-sensor-level-surface');
    expect(level).toContain('translateY(122.5px)');
    expect(battery).not.toContain('data-sensor-level-tank');
    expect(battery).not.toContain('data-sensor-level-surface');
    expect(battery).toContain('data-sensor-visualizer="battery"');
  });
  it.each([-20, 0, 20, 60])('thermometer normalizes negative scale reading %s', value => {
    const html = renderToStaticMarkup(<SensorThermometer value={value} scale={{ min: -20, max: 60, source: 'metadata' }} />);
    expect(html).toContain(`data-level="${(value + 20) / 80}"`);
  });
  for (const Renderer of [SensorLevelGauge, SensorBatteryGauge]) {
    it.each([-5, 0, 25, 50, 100, 125])(`${Renderer.name} clamps %s without altering reading`, value => {
      expect(renderToStaticMarkup(<Renderer value={value} scale={{ min: 0, max: 100, source: 'percentage' }} />))
        .toContain(`data-level="${Math.min(1, Math.max(0, value / 100))}"`);
    });
  }
  for (const Renderer of [SensorThermometer, SensorLevelGauge, SensorBatteryGauge]) {
    it('keeps ' + Renderer.name + ' neutral without reading', () => {
      const html = renderToStaticMarkup(<Renderer value={null} scale={{ min: 0, max: 100, source: 'metadata' }} />);
      expect(html).not.toContain('data-level=');
      expect(html).toContain('visibility:hidden');
      expect(html).not.toContain('aria-valuenow');
    });
  }
  it.each([
    ['temperature', '°C', 'thermometer'], ['battery', '%', 'battery'],
    ['humidity', '%', 'gauge'], ['pressure', 'bar', 'gauge'],
    ['water_level', '%', 'level'], ['unknown', '%', 'level'], ['unknown', null, 'gauge'],
  ] as const)('auto resolves %s from metadata', (deviceClass, unit, expected) => {
    expect(resolveSensorVisualStyle('auto', deviceClass, unit)).toBe(expected);
    expect(resolveSensorVisualStyle('gauge', deviceClass, unit)).toBe('gauge');
  });
  it.each(['auto', 'gauge', 'thermometer', 'level', 'battery'] as const)('preserves %s in card transfer normalization', visualStyle => {
    const [card] = normalizeCards({ cards: [{ id: 's', kind: 'sensor', entityId: 'real-sensor', visualStyle, sensorScale: { min: -20, max: 60 } }] });
    expect(card.visualStyle).toBe(visualStyle);
    expect(normalizeCards({ cards: [card] })[0]).toEqual(card);
  });
});
