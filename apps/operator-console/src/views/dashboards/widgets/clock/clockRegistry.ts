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

export const CLOCK_STYLES: ClockStyleOption[] = [
  { value: 'minimal', label: 'Digital Minimal' },
  { value: 'digital', label: 'Digital Home' },
  { value: 'elegant', label: 'Digital Elegante' },
  { value: 'analog-classic', label: 'AnalÃ³gico Classic' },
  { value: 'analog-orbit', label: 'AnalÃ³gico Orbit' },
  { value: 'analog-minimal', label: 'AnalÃ³gico Minimal' },
];

export const CLOCK_DESIGN_COMPONENTS: Record<ClockStyle, ComponentType<ClockDesignProps>> = {
  minimal: MinimalClock,
  digital: DigitalClock,
  elegant: ElegantClock,
  'analog-classic': AnalogClassicClock,
  'analog-orbit': AnalogOrbitClock,
  'analog-minimal': AnalogMinimalClock,
};