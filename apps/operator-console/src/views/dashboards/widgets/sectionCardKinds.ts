import type { WidgetType } from '../types';
import type { ClockStyle } from './ClockWidget';
import type { NormalizedSectionCardItem, NormalizedSectionCardKind, SectionCardKind, SectionCardSpan } from './sectionCardTypes';

export const cardKinds: NormalizedSectionCardKind[] = [
  'light',
  'cover',
  'camera',
  'sensor',
  'info_time',
  'media',
  'clock_premium',
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
  // The selectable Button card is `light` and defaults to four per row.
  if (normalized === 'light') return 'small';
  // Legacy action cards and other tiles retain their two-per-row default.
  if (normalized === 'action' || normalized === 'device' || normalized === 'cover') return 'medium';
  if (normalized === 'sensor') return 'medium';
  if (isClockKind(normalized)) return 'full';
  // Media players and cameras default to the section's full width.
  if (normalized === 'camera' || normalized === 'media') return 'full';
  return 'medium';
}

// Quarter-width cards are reserved for the shared light/activator tile.
// Every other card needs a wider surface for its controls or content. Persisted legacy
// spans are normalized through this same rule so the editor and renderer
// cannot diverge. Media players always need the full section width.
const COMPACT_TILE_KINDS = new Set<NormalizedSectionCardKind>(['light', 'action']);

export function canUseCompactSpan(kind: SectionCardKind): boolean {
  return COMPACT_TILE_KINDS.has(normalizeKind(kind));
}

export function getEffectiveCardSpan(kind: SectionCardKind, span: SectionCardSpan): SectionCardSpan {
  if (normalizeKind(kind) === 'sensor') return 'medium';
  if (normalizeKind(kind) === 'media') return 'full';
  if (span === 'small' && !canUseCompactSpan(kind)) return 'medium';
  return span;
}

// Groups the "add card" catalog into a few chips (Home Assistant's add-card
// dialog groups by domain/suggestion instead of one flat list), so users
// can narrow the picker without typing a search term.
export type SectionCardCategory = 'control' | 'info' | 'clock';

export function getCatalogCategory(kind: SectionCardKind): SectionCardCategory {
  const normalized = normalizeKind(kind);
  if (isClockKind(normalized)) return 'clock';

  switch (normalized) {
    case 'sensor':
    case 'info_time':
    case 'info_weather':
    case 'info_sensor':
      return 'info';
    case 'light':
    case 'cover':
    case 'camera':
    case 'media':
    case 'action':
    default:
      return 'control';
  }
}

export const catalogCategories: ReadonlyArray<{ key: SectionCardCategory; labelKey: string }> = [
  { key: 'control', labelKey: 'dashboard.editor.sections.category_control' },
  { key: 'info', labelKey: 'dashboard.editor.sections.category_info' },
  { key: 'clock', labelKey: 'dashboard.editor.sections.category_clock' },
];

export const clockCardOptions: { kind: NormalizedSectionCardKind; style: ClockStyle; labelKey: string }[] = [
  { kind: 'clock_premium', style: 'analog-classic', labelKey: 'dashboard.editor.sections.section_card_clock' },
];

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
    || normalized === 'info_sensor'
    || normalized === 'media'
    || normalized === 'action'
    || normalized === 'room'
    || normalized === 'scene';
}

// A section uses two columns on phones and four from the small breakpoint.
// The named spans preserve desktop density while keeping touch-sized cards.
export function getSpanClass(span: SectionCardSpan) {
  switch (span) {
    case 'full':
      return 'col-span-full';
    case 'medium':
      return 'col-span-6';
    case 'small':
    default:
      return 'col-span-6 sm:col-span-3';
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
  void kind;
  return 'dashboard.editor.sections.section_card_clock';
}

export function getClockStyleForKind(kind: SectionCardKind): ClockStyle {
  void kind;
  return 'analog-classic';
}
