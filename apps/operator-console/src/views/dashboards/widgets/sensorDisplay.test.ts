import { displayValue, formatSensorValue, getCategoryLabel } from './sensorDisplay';

const t = (key: string) => `t:${key}`;

describe('sensorDisplay helpers', () => {
  it('translates known state words and falls back to the raw value', () => {
    expect(displayValue('Open', t)).toBe('t:dashboard.editor.sections.sensor_open');
    expect(displayValue('not charging', t)).toBe('t:dashboard.editor.sections.sensor_not_charging');
    expect(displayValue('custom', t)).toBe('custom');
    expect(displayValue(null, t)).toBe('—');
  });

  it('maps every category to its label key and defaults to status', () => {
    expect(getCategoryLabel('air_quality', t)).toBe('t:dashboard.editor.sections.sensor_air_quality');
    expect(getCategoryLabel('status', t)).toBe('t:dashboard.editor.sections.sensor_status');
  });

  it('formats values with optional decimals', () => {
    expect(formatSensorValue(5.678, false)).toBe('6');
    expect(formatSensorValue(5.678, true)).toMatch(/5[.,]68/);
  });
});
