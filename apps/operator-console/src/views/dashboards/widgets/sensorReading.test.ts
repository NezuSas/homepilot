import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { asRecord, getSensorReading, getSensorSeverity, numericValue, resolveSensorVisualStyle } from './sensorReading';

function sensor(name: string, state: Record<string, unknown>): SnapshotDevice {
  return { id: name, homeId: 'home', roomId: null, name, type: 'sensor', status: 'ASSIGNED', lastKnownState: state };
}

describe('sensorReading helpers', () => {
  it('asRecord only accepts plain objects', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1])).toEqual({});
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('numericValue accepts decimal commas and rejects text', () => {
    expect(numericValue('22,4')).toBe(22.4);
    expect(numericValue('abc')).toBeNull();
    expect(numericValue(null)).toBeNull();
  });

  it('returns the battery preview reading without a device', () => {
    expect(getSensorReading(undefined, true)).toMatchObject({ value: '50', category: 'battery', percentage: 50 });
  });

  it('classifies and bounds a battery percentage', () => {
    const reading = getSensorReading(sensor('Device', { state: '15', unit_of_measurement: '%', device_class: 'battery' }));
    expect(reading).toMatchObject({ category: 'battery', percentage: 15, presentation: 'percentage' });
    expect(getSensorSeverity(reading)).toBe('critical');
  });

  it('detects binary states and unavailable values', () => {
    expect(getSensorReading(sensor('Door', { state: 'on' })).binaryState).toBe('on');
    const unavailable = getSensorReading(sensor('Door', { state: 'unavailable' }));
    expect(unavailable.value).toBeNull();
    expect(getSensorSeverity(unavailable)).toBe('unavailable');
  });

  it('keeps unbounded categories informational', () => {
    const reading = getSensorReading(sensor('Meter', { state: '320', unit_of_measurement: 'W' }));
    expect(reading.category).toBe('power');
    expect(getSensorSeverity(reading)).toBe('informational');
  });

  it('resolves automatic visual styles from device class and unit', () => {
    expect(resolveSensorVisualStyle('gauge', 'battery', null)).toBe('gauge');
    expect(resolveSensorVisualStyle('auto', 'temperature', null)).toBe('thermometer');
    expect(resolveSensorVisualStyle('auto', 'battery', null)).toBe('battery');
    expect(resolveSensorVisualStyle('auto', 'humidity', '%')).toBe('gauge');
    expect(resolveSensorVisualStyle('auto', '', '%')).toBe('level');
  });
});
