import type { CardColumns, CardGridOptions } from '../types';
import type { CSSProperties } from 'react';
import { MASONRY_ROW_GAP_PX, MASONRY_ROW_UNIT_PX } from './useMasonryRowSpans';

export const CARD_EDITOR_MAX_ROWS = 8;

/** Pointer position maps to bounded cells; the same calculation serves touch. */
export function pickCardGridSize(initial: CardGridOptions, x: number, y: number, width: number, height: number): CardGridOptions {
  if (width <= 0 || height <= 0) return initial;
  const rowLimit = Math.min(initial.maxRows ?? CARD_EDITOR_MAX_ROWS, CARD_EDITOR_MAX_ROWS);
  return {
    ...initial,
    columns: Math.min(initial.maxColumns ?? 12, Math.max(initial.minColumns ?? 1, Math.ceil(x / width * 12))) as CardColumns,
    rows: Math.min(rowLimit, Math.max(initial.minRows ?? 1, Math.ceil(y / height * CARD_EDITOR_MAX_ROWS))),
  };
}

/** Preserve approximate absolute card width on an explicit Section resize.
 * Full-width cards intentionally continue to follow the whole Section. */
export function fitCardsToSectionWidth(cards: unknown, previousSpan: number, nextSpan: number): unknown {
  if (!Array.isArray(cards) || previousSpan === nextSpan || previousSpan < 1 || nextSpan < 1) return cards;
  return cards.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const card = value as Record<string, unknown>;
    const options = card.gridOptions && typeof card.gridOptions === 'object' && !Array.isArray(card.gridOptions)
      ? card.gridOptions as Record<string, unknown> : undefined;
    if (options?.columns === 'full' || (!options && card.span === 'full')) return card;
    const columns = typeof options?.columns === 'number' ? options.columns : card.span === 'small' ? 3 : 6;
    const minimum = typeof options?.minColumns === 'number' ? options.minColumns : 1;
    const maximum = typeof options?.maxColumns === 'number' ? options.maxColumns : 12;
    const fitted = Math.min(maximum, Math.max(minimum, Math.round(columns * previousSpan / nextSpan)));
    return { ...card, gridOptions: { ...options, columns: fitted, rows: options?.rows ?? 'auto' } };
  });
}

export function getCardGridHeight(rows: CardGridOptions['rows'] | undefined): number | undefined {
  return typeof rows === 'number' ? rows * (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX) - MASONRY_ROW_GAP_PX : undefined;
}

/** Shared visual budget for the live card and its editor preview; auto has no cap.
 * Only decorative instruments use this budget, never interactive hit targets. */
export function getCardPresentationStyle(rows: CardGridOptions['rows'] | undefined): CSSProperties {
  const height = getCardGridHeight(rows);
  return {
    containerType: 'inline-size',
    ...(height === undefined ? {} : { '--dashboard-card-height': `${height}px` }),
  } as CSSProperties;
}

export function getCardGridRowSpan(rows: CardGridOptions['rows'] | undefined, measuredRows: number, minimumRows = 1): number {
  return Math.max(measuredRows, typeof rows === 'number' ? rows : minimumRows);
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
