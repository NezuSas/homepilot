import type { CardColumns, CardGridOptions } from '../types';
import { MASONRY_ROW_GAP_PX, MASONRY_ROW_UNIT_PX } from './useMasonryRowSpans';

export const CARD_EDITOR_MAX_ROWS = 12;

export function getCardGridHeight(rows: CardGridOptions['rows'] | undefined): number | undefined {
  return typeof rows === 'number' ? rows * (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX) - MASONRY_ROW_GAP_PX : undefined;
}

export function getCardGridWidth(sectionWidth: number, columns: CardGridOptions['columns']): number {
  const count = columns === 'full' ? 12 : columns;
  return Math.max(0, (sectionWidth + MASONRY_ROW_GAP_PX) * count / 12 - MASONRY_ROW_GAP_PX);
}

/** Live cards and editor previews share the same exterior surface. */
export function getCardFrameClass(kind: string, span: string, active = false): string {
  const tile = ['device', 'light', 'action'].includes(kind);
  return [
    kind === 'sensor' ? 'rounded-2xl' : 'rounded-section',
    tile ? 'min-h-device-card-compact' : span === 'small' ? 'min-h-section-card-sm' : span === 'medium' ? 'min-h-section-card-md' : 'min-h-section-card-lg',
    kind === 'camera' && 'min-h-curtain-card',
    kind.startsWith('clock') && 'min-h-clock-card',
    kind === 'cover' && 'w-full max-w-curtain-dashboard justify-self-start sm:min-h-curtain-card',
    ['light', 'action'].includes(kind) && (active ? 'homepilot-section-light-tile-active' : 'border border-transparent'),
  ].filter(Boolean).join(' ');
}

/** Size constraints apply to gestures and keyboard alike; never mutate input. */
export function resizeCardGrid(initial: CardGridOptions, columnsDelta: number, rowsDelta: number, measuredRows: number): CardGridOptions {
  const columns = initial.columns === 'full' ? 12 : initial.columns;
  const rows = initial.rows === 'auto' ? measuredRows : initial.rows;
  return {
    ...initial,
    columns: Math.min(initial.maxColumns ?? 12, Math.max(initial.minColumns ?? 1, columns + columnsDelta)) as CardColumns,
    rows: rowsDelta === 0 ? initial.rows : Math.min(initial.maxRows ?? CARD_EDITOR_MAX_ROWS, Math.max(initial.minRows ?? 1, rows + rowsDelta)),
  };
}
