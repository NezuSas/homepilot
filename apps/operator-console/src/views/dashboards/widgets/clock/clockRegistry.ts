import type { ComponentType } from 'react';
import {
  AnalogClassicClock,
  AnalogMinimalClock,
  AnalogOrbitClock,
  DigitalClock,
  ElegantClock,
  MinimalClock,
} from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_MIN_LAYOUT = { w: 4, h: 4 } as const;

export const CLOCK_STYLES: ClockStyleOption[] = [
  {
    value: 'minimal',
    label: 'Digital minimal',
    labelEs: 'Digital minimal',
    labelEn: 'Digital minimal',
    minW: 4,
    minH: 4,
  },
  {
    value: 'digital',
    label: 'Digital hogar',
    labelEs: 'Digital hogar',
    labelEn: 'Digital home',
    minW: 4,
    minH: 4,
  },
  {
    value: 'elegant',
    label: 'Digital elegante',
    labelEs: 'Digital elegante',
    labelEn: 'Elegant digital',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-classic',
    label: 'Anal\u00f3gico cl\u00e1sico',
    labelEs: 'Anal\u00f3gico cl\u00e1sico',
    labelEn: 'Classic analog',
    minW: 4,
    minH: 4,
  },
  {
    value: 'analog-orbit',
    label: 'Anal\u00f3gico \u00f3rbita',
    labelEs: 'Anal\u00f3gico \u00f3rbita',
    labelEn: 'Orbit analog',
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
  elegant: ElegantClock,
  'analog-classic': AnalogClassicClock,
  'analog-orbit': AnalogOrbitClock,
  'analog-minimal': AnalogMinimalClock,
};

export function getClockStyleLabel(style: ClockStyleOption, locale?: string): string {
  return locale?.toLowerCase().startsWith('en') ? style.labelEn : style.labelEs;
}

export function getClockMinimumLayout(style?: ClockStyle): { w: number; h: number } {
  const selected = CLOCK_STYLES.find((item) => item.value === style);
  return { w: selected?.minW ?? CLOCK_MIN_LAYOUT.w, h: selected?.minH ?? CLOCK_MIN_LAYOUT.h };
}