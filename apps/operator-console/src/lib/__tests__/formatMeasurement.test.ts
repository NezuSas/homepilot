import { formatMeasurement } from '../formatMeasurement';

describe('Shared measurement presentation (Modbus AC35)', () => {
  it.each([[22.4567, '22.46'], [-22.4567, '-22.46'], [0, '0'], [100, '100'], [0.004, '0'], [1234.567, '1234.57']])('formats %s without altering the source', (value, expected) => {
    const original = Number(value);
    expect(formatMeasurement(original)).toBe(expected);
    expect(original).toBe(Number(value));
  });
  it('preserves integer opt-out and locale', () => {
    expect(formatMeasurement(22.456, 0)).toBe('22');
    expect(formatMeasurement(22.456, 2, 'es')).toBe('22,46');
    expect(formatMeasurement(NaN)).toBe('—');
  });
});
