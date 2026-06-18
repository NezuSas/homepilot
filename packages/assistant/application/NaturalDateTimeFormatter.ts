const SPANISH_NUMBERS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'
] as const;

function spanishNumber(value: number): string {
  if (value < SPANISH_NUMBERS.length) return SPANISH_NUMBERS[value];

  const tens = Math.floor(value / 10);
  const unit = value % 10;
  const tensWord = tens === 3 ? 'treinta' : tens === 4 ? 'cuarenta' : 'cincuenta';
  return unit === 0 ? tensWord : `${tensWord} y ${SPANISH_NUMBERS[unit]}`;
}

export type SpanishDayPeriod = 'madrugada' | 'mañana' | 'tarde' | 'noche';

export function getSpanishDayPeriod(hour: number): SpanishDayPeriod {
  if (hour < 5) return 'madrugada';
  if (hour < 12) return 'mañana';
  if (hour < 20) return 'tarde';
  return 'noche';
}

export function formatNaturalSpanishTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
  const hour12 = hour % 12 || 12;
  const spokenHour = hour12 === 1 ? 'una' : spanishNumber(hour12);
  const spokenMinute = minute === 0 ? 'en punto' : `y ${spanishNumber(minute)}`;
  const prefix = hour12 === 1 ? 'Es la' : 'Son las';

  return `${prefix} ${spokenHour} ${spokenMinute} de la ${getSpanishDayPeriod(hour)}`;
}
