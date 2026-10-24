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

  // Called two or three times per row of the Modbus card, and again on every keystroke in its search
  // box, for a formatter that only ever has two useful shapes.
  it('builds one formatter per locale and precision instead of one per call', () => {
    const NumberFormat = Intl.NumberFormat;
    const built: string[] = [];
    const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation(((locale: string, options: Intl.NumberFormatOptions) => {
      built.push(`${locale}|${options.maximumFractionDigits}`);
      return new NumberFormat(locale, options);
    }) as unknown as typeof Intl.NumberFormat);

    try {
      // A locale and precision pair this suite has not formatted yet, so the cache starts cold for it.
      for (let i = 0; i < 25; i += 1) expect(formatMeasurement(i + 0.5, 2, 'de-DE')).toContain(',5');
      expect(built).toEqual(['de-DE|2']);

      formatMeasurement(1.5, 0, 'de-DE');
      expect(built).toEqual(['de-DE|2', 'de-DE|0']);
    } finally {
      spy.mockRestore();
    }
  });
});
