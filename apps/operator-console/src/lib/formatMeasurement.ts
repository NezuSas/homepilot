// Built once per locale and precision rather than per call: this runs two or three times per table row
// in the Modbus card, on every keystroke in its search box, and only two formatters are ever needed.
const numberFormatters = new Map<string, Intl.NumberFormat>();

/** Presentation only: never round the underlying measurement or RAW registers. */
export function formatMeasurement(value: number, maximumFractionDigits: 0 | 2 = 2, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '—';
  const cacheKey = `${locale}|${maximumFractionDigits}`;
  let formatter = numberFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits });
    numberFormatters.set(cacheKey, formatter);
  }
  return formatter.format(value);
}
