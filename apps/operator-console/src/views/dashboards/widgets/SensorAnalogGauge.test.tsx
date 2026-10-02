import { renderToStaticMarkup } from 'react-dom/server';
import { formatSensorGaugeTick, getSensorGaugeScale, sensorNeedleFraction, SensorAnalogGauge } from './SensorAnalogGauge';

describe('Sensor analog instrument scale', () => {
  it.each([[150000, '150k'], [75000, '75k'], [-150000, '-150k'], [1013, '1013'], [3.2, '3.2']])('labels tick %s without rounding it to a different scale boundary', (value, label) => {
    expect(formatSensorGaugeTick(value)).toBe(label);
  });
  it('uses 0–100 for percentages without claiming a safe range', () => {
    expect(getSensorGaugeScale(58, true)).toEqual({ min: 0, max: 100, source: 'percentage' });
    expect(sensorNeedleFraction(58, getSensorGaugeScale(58, true))).toBe(0.58);
  });
  it.each([[22, '°C', -10, 50], [3.2, 'bar', 0, 6], [1013, 'hPa', 950, 1050]])('uses the reference display window for %s %s', (value, unit, min, max) => {
    expect(getSensorGaugeScale(value, false, undefined, undefined, unit)).toEqual({ min, max, source: 'automatic' });
  });
  it('honors actual metadata including negative bounds and decimal strings', () => {
    const scale = getSensorGaugeScale(3.2, false, '1.5', '4.0', 'bar');
    expect(scale).toEqual({ min: 1.5, max: 4, source: 'metadata' });
    expect(sensorNeedleFraction(3.2, scale)).toBeCloseTo(0.68);
  });
  it.each([0, -12.5, 63, 1240, 123456.7])('automatically encloses %s without discarding the reading', value => {
    const scale = getSensorGaugeScale(value, false, 'invalid', null, '°C');
    expect(scale.max).toBeGreaterThan(scale.min);
    expect(value).toBeGreaterThanOrEqual(scale.min);
    expect(value).toBeLessThanOrEqual(scale.max);
    expect(Number.isFinite(sensorNeedleFraction(value, scale))).toBe(true);
  });
  it('bounds only the needle; the caller retains the true out-of-scale reading', () => {
    const scale = getSensorGaugeScale(150, true);
    expect(sensorNeedleFraction(150, scale)).toBe(1);
    expect(sensorNeedleFraction(-5, scale)).toBe(0);
  });
  it('keeps a missing measurement decorative, with no fabricated meter value', () => {
    const html = renderToStaticMarkup(<SensorAnalogGauge value={null} scale={null} />);
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('aria-valuenow');
  });
});
