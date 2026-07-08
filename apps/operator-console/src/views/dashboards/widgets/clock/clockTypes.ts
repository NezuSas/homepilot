import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle =
  | 'minimal'
  | 'digital'
  | 'elegant'
  | 'analog-classic'
  | 'analog-orbit'
  | 'analog-minimal';

export interface ClockWeather {
  temperature: number;
  code: number;
  windSpeed?: number;
  updatedAt: string;
  location: string;
  label: string;
}

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
  locale: string;
  copy: ClockCopy;
  weather: ClockWeather | null;
  weatherStatus: 'idle' | 'loading' | 'ready' | 'error';
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
}

export interface ClockCopy {
  localTime: string;
  digitalPro: string;
  homeTime: string;
  analogClassic: string;
  analogOrbit: string;
  analogMinimal: string;
  residentialEdge: string;
  sync: string;
  secondsShort: string;
  dayProgress: string;
  weatherLoading: string;
  weatherUnavailable: string;
  cuenca: string;
  am: string;
  pm: string;
}