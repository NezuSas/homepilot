import type { ComponentType } from 'react';
import { HomePilotClock } from './designs/HomePilotClock';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_MIN_LAYOUT = { w: 4, h: 4 } as const;

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'analog-classic',
    label: 'Reloj',
    labelEs: 'Reloj',
    labelEn: 'Clock',
    minW: 4,
    minH: 4,
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
