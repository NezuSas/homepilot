import type { ComponentType } from 'react';
import { DigitalClock, ElegantClock, MinimalClock } from './designs';
import type { ClockDesignProps, ClockStyle, ClockStyleOption } from './clockTypes';

export const CLOCK_STYLES: ClockStyleOption[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'digital', label: 'Digital Pro' },
  { value: 'elegant', label: 'Elegante' },
];

export const CLOCK_DESIGNS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
};
