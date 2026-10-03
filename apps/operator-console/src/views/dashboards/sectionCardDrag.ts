import { createContext } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DashboardWidget } from './types';

/** Only the active tab's canvas owns this context; standalone previews stay local. */
export const SectionCardDragContext = createContext<false | Readonly<Record<string, string>>>(false);
export const sectionCardDragId = (sectionId: string, cardId: string, identities: false | Readonly<Record<string, string>> = false) => {
  const key = JSON.stringify(['section-card', sectionId, cardId]);
  return identities && identities[key] || key;
};

type StoredCard = Record<string, unknown> & { id: string };
function storedCards(widget: DashboardWidget): StoredCard[] {
  const cards = widget.config.extra?.cards;
  return Array.isArray(cards) ? cards.filter((card): card is StoredCard => Boolean(card && typeof card === 'object' && typeof card.id === 'string')) : [];
}

/** One immutable tab update: preserve card metadata, unrelated extras and sparse slots. */
export function moveSectionCard(widgets: DashboardWidget[], sourceId: string, cardId: string, targetId: string, targetCardId?: string): DashboardWidget[] {
  const source = widgets.find((widget) => widget.id === sourceId && widget.type === 'section');
  const target = widgets.find((widget) => widget.id === targetId && widget.type === 'section');
  if (!source || !target) return widgets;
  const sourceCards = storedCards(source);
  const sourceIndex = sourceCards.findIndex((card) => card.id === cardId);
  if (sourceIndex < 0) return widgets;
  const targetCards = sourceId === targetId ? sourceCards : storedCards(target);
  const targetIndex = targetCardId ? targetCards.findIndex((card) => card.id === targetCardId) : targetCards.length;
  if (targetIndex < 0 || (sourceId !== targetId && targetCards.some((card) => card.id === cardId))) return widgets;
  if (sourceId === targetId && sourceIndex === Math.min(targetIndex, sourceCards.length - 1)) return widgets;
  const nextSource = sourceId === targetId ? arrayMove(sourceCards, sourceIndex, Math.min(targetIndex, sourceCards.length - 1)) : sourceCards.filter((card) => card.id !== cardId);
  const nextTarget = sourceId === targetId ? nextSource : [...targetCards.slice(0, targetIndex), sourceCards[sourceIndex], ...targetCards.slice(targetIndex)];
  return widgets.map((widget) => {
    const cards = widget.id === sourceId ? nextSource : widget.id === targetId ? nextTarget : null;
    return cards ? { ...widget, config: { ...widget.config, extra: { ...widget.config.extra, cards: cards.map(card => { const next = { ...card }; delete next.order; return next; }) } } } : widget;
  });
}
export const DASHBOARD_DRAG_TRANSITION = { duration: 150, easing: 'ease' };

export interface SectionCardPlacement { id: string; column: number; row: number; columns: number; rows: number }

/** Intrinsic growth may push a later placed card down, never overlap it.
 * This is a render projection, not an automatic persistence rewrite. */
export function resolvePlacedCardRows(positions: SectionCardPlacement[]): Record<string, number> {
  const occupied: SectionCardPlacement[] = [];
  const result: Record<string, number> = {};
  for (const position of positions) {
    let row = position.row;
    for (let attempts = 0; attempts <= occupied.length; attempts++) {
      const collisions = occupied.filter(value => position.column < value.column + value.columns && position.column + position.columns > value.column
        && row < value.row + value.rows && row + position.rows > value.row);
      if (!collisions.length) break;
      row = Math.max(...collisions.map(value => value.row + value.rows));
    }
    result[position.id] = row;
    occupied.push({ ...position, row });
  }
  return result;
}

/** Dropping into blank space freezes the visible layout, preserving the hole
 * left by the moved card. Existing dashboards remain auto-flow until this edit. */
export function placeSectionCard(widgets: DashboardWidget[], sourceId: string, cardId: string, targetId: string,
  column: number, row: number, placements: Readonly<Record<string, SectionCardPlacement[]>>): DashboardWidget[] {
  const source = widgets.find(widget => widget.id === sourceId && widget.type === 'section');
  const target = widgets.find(widget => widget.id === targetId && widget.type === 'section');
  if (!source || !target || !Number.isFinite(column) || !Number.isFinite(row)) return widgets;
  const card = storedCards(source).find(value => value.id === cardId);
  const measured = placements[sourceId]?.find(value => value.id === cardId);
  if (!card || !measured || (sourceId !== targetId && storedCards(target).some(value => value.id === cardId))) return widgets;
  const startColumn = Math.max(1, Math.min(13 - measured.columns, Math.round(column)));
  let startRow = Math.max(1, Math.min(10000, Math.round(row)));
  const occupied = (placements[targetId] ?? []).filter(value => value.id !== cardId);
  while (occupied.some(value => startColumn < value.column + value.columns && startColumn + measured.columns > value.column
    && startRow < value.row + value.rows && startRow + measured.rows > value.row)) {
    if (++startRow > 10000) return widgets;
  }
  const freeze = (value: StoredCard, placement: SectionCardPlacement | undefined) => {
    if (!placement) return value;
    const options = value.gridOptions && typeof value.gridOptions === 'object' && !Array.isArray(value.gridOptions)
      ? value.gridOptions as Record<string, unknown> : { columns: placement.columns, rows: 'auto' };
    return { ...value, gridOptions: { ...options, columnStart: placement.column, rowStart: placement.row } };
  };
  const moved = freeze(card, { ...measured, column: startColumn, row: startRow });
  return widgets.map(widget => {
    if (widget.id !== sourceId && widget.id !== targetId) return widget;
    const cards = storedCards(widget).filter(value => value.id !== cardId)
      .map(value => freeze(value, placements[widget.id]?.find(position => position.id === value.id)));
    if (widget.id === targetId) cards.push(moved);
    return { ...widget, config: { ...widget.config, extra: { ...widget.config.extra, cards } } };
  });
}
