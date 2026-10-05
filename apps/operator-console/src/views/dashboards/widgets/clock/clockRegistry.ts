import type { ComponentType } from 'react';
import { HomePilotClock } from './designs/HomePilotClock';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';
import type { CardGridOptions } from '../../types';

/** AC56: minimum readable dial is 70px at 300px useful Section width. */
export const CLOCK_GRID = {
  default: { columns: 12, rows: 6 },
  min: { columns: 4, rows: 4 },
  max: { columns: 12, rows: 8 },
} as const;
export const CLOCK_MIN_LAYOUT = { w: CLOCK_GRID.min.columns, h: CLOCK_GRID.min.rows } as const;

/** Local projection only: historical JSON is not written back on load. */
export function getClockGridOptions(saved?: Omit<Partial<CardGridOptions>, 'columns'> & { columns?: number | 'full' }): CardGridOptions {
  const columns = typeof saved?.columns === 'number' && Number.isFinite(saved.columns) ? Math.round(saved.columns) : CLOCK_GRID.default.columns;
  const rows = typeof saved?.rows === 'number' && Number.isFinite(saved.rows) ? Math.round(saved.rows) : CLOCK_GRID.default.rows;
  const fitted = Math.max(CLOCK_GRID.min.columns, Math.min(CLOCK_GRID.max.columns, columns)) as CardGridOptions['columns'];
  return { ...saved, columns: fitted, rows: Math.max(CLOCK_GRID.min.rows, Math.min(CLOCK_GRID.max.rows, rows)),
    minColumns: CLOCK_GRID.min.columns, minRows: CLOCK_GRID.min.rows,
    maxColumns: CLOCK_GRID.max.columns, maxRows: CLOCK_GRID.max.rows,
    ...(saved?.columnStart === undefined ? {} : { columnStart: Math.min(saved.columnStart, 13 - Number(fitted)) }) };
}

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'analog-classic',
    label: 'Reloj',
    labelEs: 'Reloj',
    labelEn: 'Clock',
    minW: CLOCK_GRID.min.columns,
    minH: CLOCK_GRID.min.rows,
  },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: HomePilotClock,
  digital: HomePilotClock,
  'analog-classic': HomePilotClock,
  'analog-minimal': HomePilotClock,
};

export function getClockStyleLabel(style: ClockStyleOption, locale?: string): string {
  return locale?.toLowerCase().startsWith('en') ? style.labelEn : style.labelEs;
}

export function getClockMinimumLayout(style?: ClockStyle): { w: number; h: number } {
  const selected = CLOCK_STYLES.find((item) => item.value === style);
  return { w: selected?.minW ?? CLOCK_MIN_LAYOUT.w, h: selected?.minH ?? CLOCK_MIN_LAYOUT.h };
}

export function isVisibleClockStyle(style: ClockStyle): boolean {
  return CLOCK_STYLES.some((item) => item.value === style);
}

export function normalizeClockStyle(style: unknown): ClockStyle {
  switch (style) {
    case 'digital':
      return 'digital';
    case 'analog-classic':
    case 'analog-orbit':
      return 'analog-classic';
    case 'analog-minimal':
      return 'analog-minimal';
    case 'minimal':
    case 'elegant':
    default:
      return 'minimal';
  }
}
