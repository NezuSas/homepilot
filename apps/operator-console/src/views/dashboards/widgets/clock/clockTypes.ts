import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle = 'minimal' | 'digital' | 'elegant';

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
  locale: string;
  copy: ClockCopy;
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
}

export interface ClockCopy {
  localTime: string;
  digitalPro: string;
  homeTime: string;
  residentialEdge: string;
  sync: string;
  secondsShort: string;
  am: string;
  pm: string;
}