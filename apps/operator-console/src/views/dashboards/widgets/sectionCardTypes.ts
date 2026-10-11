import type { CardGridOptions, WidgetType } from '../types';

export type SectionCardKind =
  | 'device'
  | 'light'
  | 'cover'
  | 'camera'
  | 'sensor'
  | 'info_time'
  | 'info_weather'
  | 'info_sensor'
  | 'media'
  | 'action'
  | 'room'
  | 'scene'
  | 'clock'
  | 'clock_digital'
  | 'clock_analog'
  | 'clock_premium'
  | 'clock_minimal'
  | 'energy'
  | 'assistant';

export type NormalizedSectionCardKind = Exclude<SectionCardKind, 'clock'>;
export type LegacySectionCardKind = SectionCardKind | 'system';
export type SectionCardSpan = 'small' | 'medium' | 'full';
export type SectionCardIcon = string;
export type MediaVariant = 'premium' | 'classic';
export type SensorVisualStyle = 'auto' | 'gauge' | 'thermometer' | 'level' | 'battery' | 'switch';
export const sensorVisualStyles: SensorVisualStyle[] = ['auto', 'gauge', 'thermometer', 'level', 'battery', 'switch'];
export function normalizeSensorVisualStyle(value: unknown): SensorVisualStyle {
  return sensorVisualStyles.find(style => style === value) ?? 'gauge';
}
export interface SensorScale { min: number; max: number }
export function normalizeSensorScale(value: unknown): SensorScale | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { min, max } = value as Partial<SensorScale>;
  return typeof min === 'number' && typeof max === 'number' && Number.isFinite(min) && Number.isFinite(max) && min < max
    ? { min, max } : undefined;
}

export function normalizeMediaVariant(value: unknown): MediaVariant {
  return value === 'classic' ? 'classic' : 'premium';
}

export interface SectionCardItem {
  id: string;
  kind: SectionCardKind;
  title: string;
  description?: string;
  widgetType?: WidgetType;
  entityId?: string;
  entityName?: string;
  span?: SectionCardSpan;
  icon?: SectionCardIcon;
  mediaVariant?: MediaVariant;
  sensorScale?: SensorScale;
  visualStyle?: SensorVisualStyle;
  sensorDecimals?: boolean;
  gridOptions?: CardGridOptions;
  hidden?: boolean;
}

export interface NormalizedSectionCardItem extends Omit<SectionCardItem, 'kind'> {
  kind: NormalizedSectionCardKind;
}

export interface CardDraft {
  title: string;
  kind: NormalizedSectionCardKind;
  entityId: string;
  span: SectionCardSpan;
  icon: SectionCardIcon;
  mediaVariant: MediaVariant;
  sensorMin?: number;
  visualStyle?: SensorVisualStyle;
  sensorMax?: number;
  sensorDecimals?: boolean;
  gridOptions?: CardGridOptions;
  hidden?: boolean;
}

export interface AssignableScene {
  id: string;
  name: string;
  icon?: string;
}

export interface AssignableAutomation {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
}

export interface AssignableDisplayAction {
  deviceId: string;
  actionKey: string;
  displayName: string;
  deviceName: string;
}
