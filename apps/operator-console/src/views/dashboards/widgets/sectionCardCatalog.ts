import type { DashboardWidgetConfig, WidgetType } from '../types';
import type { ClockStyle } from './ClockWidget';

export type SectionCardKind =
  | 'device'
  | 'light'
  | 'cover'
  | 'camera'
  | 'sensor'
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
}

export interface AssignableScene {
  id: string;
  name: string;
}

export interface AssignableAutomation {
  id: string;
  name: string;
  enabled: boolean;
}

export const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const cardKinds: NormalizedSectionCardKind[] = [
  'light',
  'cover',
  'camera',
  'sensor',
  'media',
  'action',
  'room',
  'scene',
  'clock_digital',
  'clock_analog',
  'clock_premium',
  'clock_minimal',
];

export function normalizeKind(kind: SectionCardKind): NormalizedSectionCardKind {
  return kind === 'clock' ? 'clock_digital' : kind;
}

export function isClockKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'clock_digital' || normalized === 'clock_analog' || normalized === 'clock_premium' || normalized === 'clock_minimal';
}

export function getDefaultSpan(kind: SectionCardKind): SectionCardSpan {
  const normalized = normalizeKind(kind);
  if (normalized === 'light' || normalized === 'device' || normalized === 'cover' || normalized === 'action') return 'small';
  if (isClockKind(normalized)) return 'full';
  if (normalized === 'camera') return 'full';
  return 'medium';
}

export const clockCardOptions: { kind: NormalizedSectionCardKind; style: ClockStyle; labelKey: string }[] = [
  { kind: 'clock_premium', style: 'analog-classic', labelKey: 'dashboard.editor.sections.clock_style_premium' },
  { kind: 'clock_digital', style: 'digital', labelKey: 'dashboard.editor.sections.clock_style_digital' },
  { kind: 'clock_analog', style: 'minimal', labelKey: 'dashboard.editor.sections.clock_style_residential' },
  { kind: 'clock_minimal', style: 'analog-minimal', labelKey: 'dashboard.editor.sections.clock_style_minimal' },
];


export function getCatalogLabelKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'dashboard.editor.sections.section_card_light';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera';
    case 'sensor':
      return 'dashboard.editor.sections.section_card_sensor';
    case 'media':
      return 'dashboard.editor.sections.section_card_media';
    case 'action':
      return 'dashboard.editor.sections.section_card_action';
    case 'room':
      return 'dashboard.editor.sections.section_card_room';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene';
    case 'clock_digital':
      return 'dashboard.editor.sections.section_card_clock_digital';
    case 'clock_analog':
      return 'dashboard.editor.sections.section_card_clock_analog';
    case 'clock_premium':
      return 'dashboard.editor.sections.section_card_clock_premium';
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock_minimal';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant';
    case 'device':
    default:
      return 'dashboard.editor.sections.section_card_device';
  }
}

export function getCatalogDescriptionKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'dashboard.editor.sections.section_card_light_desc';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover_desc';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera_desc';
    case 'sensor':
      return 'dashboard.editor.sections.section_card_sensor_desc';
    case 'media':
      return 'dashboard.editor.sections.section_card_media_desc';
    case 'action':
      return 'dashboard.editor.sections.section_card_action_desc';
    case 'room':
      return 'dashboard.editor.sections.section_card_room_desc';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene_desc';
    case 'clock_digital':
      return 'dashboard.editor.sections.section_card_clock_digital_desc';
    case 'clock_analog':
      return 'dashboard.editor.sections.section_card_clock_analog_desc';
    case 'clock_premium':
      return 'dashboard.editor.sections.section_card_clock_premium_desc';
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock_minimal_desc';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy_desc';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant_desc';
    case 'device':
    default:
      return 'dashboard.editor.sections.section_card_device_desc';
  }
}

export function getWidgetType(kind: SectionCardKind): WidgetType {
  switch (normalizeKind(kind)) {
    case 'room':
      return 'room_overview' as WidgetType;
    case 'scene':
      return 'scene_shortcut' as WidgetType;
    case 'energy':
      return 'energy_snapshot' as WidgetType;
    case 'assistant':
      return 'assistant_insight' as WidgetType;
    case 'action':
      return 'action_button' as WidgetType;
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'clock_display' as WidgetType;
    case 'device':
    case 'light':
    case 'cover':
    case 'camera':
    case 'sensor':
    case 'media':
    default:
      return 'device_control' as WidgetType;
  }
}

export function isBindableKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'device'
    || normalized === 'light'
    || normalized === 'cover'
    || normalized === 'camera'
    || normalized === 'sensor'
    || normalized === 'media'
    || normalized === 'action'
    || normalized === 'room'
    || normalized === 'scene';
}

export function getDefaultIcon(kind: SectionCardKind): SectionCardIcon {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'mdi:lightbulb';
    case 'cover':
      return 'Blinds';
    case 'camera':
      return 'Camera';
    case 'sensor':
      return 'Gauge';
    case 'media':
      return 'Music2';
    case 'action':
      return 'MousePointerClick';
    case 'room':
      return 'Home';
    case 'scene':
      return 'Sparkles';
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'Clock';
    case 'energy':
      return 'Zap';
    case 'assistant':
      return 'Bot';
    case 'device':
    default:
      return 'Power';
  }
}

export function normalizeCards(extra?: DashboardWidgetConfig['extra']): NormalizedSectionCardItem[] {
  const rawCards = Array.isArray(extra?.cards) ? extra.cards : [];

  return rawCards.flatMap((rawCard, index) => {
    const card = rawCard as Partial<NormalizedSectionCardItem> & Record<string, unknown>;
    const legacyKind = (card.kind as LegacySectionCardKind) || 'device';
    if (legacyKind === 'system') return [];
    const kind = normalizeKind(legacyKind);

    return [{
      id: typeof card.id === 'string' && card.id.trim() ? card.id : createId(),
      kind,
      title: typeof card.title === 'string' && card.title.trim()
        ? card.title
        : '',
      description: typeof card.description === 'string' ? card.description : '',
      widgetType: (card.widgetType as WidgetType) || getWidgetType(kind),
      entityId: typeof card.entityId === 'string' ? card.entityId : undefined,
      entityName: typeof card.entityName === 'string' ? card.entityName : undefined,
      span: isClockKind(kind)
        ? 'full'
        : card.span === 'medium' || card.span === 'full' || card.span === 'small'
          ? card.span
          : getDefaultSpan(kind),
      icon: typeof card.icon === 'string' && card.icon.trim() ? card.icon : getDefaultIcon(kind),
      order: typeof card.order === 'number' ? card.order : index,
    }];
  });
}

export function getSpanClass(span: SectionCardSpan) {
  switch (span) {
    case 'full':
      return 'col-span-full';
    case 'medium':
      return 'col-span-1 sm:col-span-2';
    case 'small':
    default:
      return 'col-span-1';
  }
}

export function getRecommendedSectionHeight(currentHeight: number, cards: NormalizedSectionCardItem[]) {
  void currentHeight;
  if (cards.length === 0) return 3;

  const rows = cards.reduce((total, card) => {
    if (card.span === 'full') return total + 1;
    if (card.span === 'medium') return total + 0.5;
    return total + 0.25;
  }, 0);

  return Math.max(4, Math.ceil(rows * 2.2) + 2);
}

export function getClockKindLabelKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'clock_digital':
      return 'dashboard.editor.sections.clock_style_digital';
    case 'clock_analog':
      return 'dashboard.editor.sections.clock_style_residential';
    case 'clock_minimal':
      return 'dashboard.editor.sections.clock_style_minimal';
    case 'clock_premium':
    default:
      return 'dashboard.editor.sections.clock_style_premium';
  }
}

export function getClockStyleForKind(kind: SectionCardKind): ClockStyle {
  const normalized = normalizeKind(kind);
  const option = clockCardOptions.find((item) => item.kind === normalized);
  return option?.style ?? 'minimal';
}

