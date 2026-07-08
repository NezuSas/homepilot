export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTimeOfDay(h: number): string {
  return h < 12 ? 'AM' : 'PM';
}

export function to12h(h: number): number {
  return h % 12 || 12;
}

export function getMinuteProgress(now: Date): number {
  return ((now.getSeconds() + 1) / 60) * 100;
}

export const SHORT_DAYS = ['DOM', 'LUN', 'MAR', 'MIÃ‰', 'JUE', 'VIE', 'SÃB'] as const;

export const LONG_DAYS = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'] as const;

export const UPPER_LONG_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÃ‰RCOLES', 'JUEVES', 'VIERNES', 'SÃBADO'] as const;

export const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'] as const;

export const LONG_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;
