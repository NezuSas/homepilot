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
  if (sourceId === targetId && (sourceIndex === targetIndex || targetIndex === sourceCards.length)) return widgets;
  const nextSource = sourceId === targetId ? arrayMove(sourceCards, sourceIndex, targetIndex) : sourceCards.filter((card) => card.id !== cardId);
  const nextTarget = sourceId === targetId ? nextSource : [...targetCards.slice(0, targetIndex), sourceCards[sourceIndex], ...targetCards.slice(targetIndex)];
  return widgets.map((widget) => {
    const cards = widget.id === sourceId ? nextSource : widget.id === targetId ? nextTarget : null;
    return cards ? { ...widget, config: { ...widget.config, extra: { ...widget.config.extra, cards: cards.map((card, order) => ({ ...card, order })) } } } : widget;
  });
}
