import type { DashboardWidgetConfig } from '../../types';

export type ClockStyle = 'minimal' | 'digital' | 'elegant';

export interface ClockWidgetProps {
  config: DashboardWidgetConfig;
}

export interface ClockDesignProps {
  now: Date;
  config: DashboardWidgetConfig;
}

export interface ClockStyleOption {
  value: ClockStyle;
  label: string;
}
