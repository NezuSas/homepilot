/** Presentation only: never round the underlying measurement or RAW registers. */
export function formatMeasurement(value: number, maximumFractionDigits: 0 | 2 = 2, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits }).format(value);
}
