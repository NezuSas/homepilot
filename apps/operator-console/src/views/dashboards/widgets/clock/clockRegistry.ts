import type { ComponentType } from 'react';
import {
  AnalogClassicClock,
  AnalogMinimalClock,
  DigitalClock,
  MinimalClock,
} from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_MIN_LAYOUT = { w: 4, h: 4 } as const;

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'minimal',
    label: 'Digital residencial',
    labelEs: 'Digital residencial',
    labelEn: 'Residential digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'digital',
    label: 'Digital compacto',
    labelEs: 'Digital compacto',
    labelEn: 'Compact digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-classic',
    label: 'Anal\u00f3gico premium',
    labelEs: 'Anal\u00f3gico premium',
    labelEn: 'Premium analog',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-minimal',
    label: 'Anal\u00f3gico minimal',
    labelEs: 'Anal\u00f3gico minimal',
    labelEn: 'Minimal analog',
    minW: 4,
    minH: 4,
  },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  'analog-classic': AnalogClassicClock,
  'analog-minimal': AnalogMinimalClock,
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