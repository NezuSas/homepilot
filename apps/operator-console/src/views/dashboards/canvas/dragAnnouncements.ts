import type { Active, Over } from '@dnd-kit/core';
import type { DashboardWidget } from '../types';
import { isSectionSlotId, SECTION_SLOT_PREFIX } from './canvasLayout';

type Translate = (key: string, options?: Record<string, unknown>) => string;
type DragItemData = { kind?: unknown; sectionId?: unknown; cardId?: unknown } | undefined;

function sectionTitle(widgets: readonly DashboardWidget[], sectionId: unknown, t: Translate): string {
  const section = widgets.find((widget) => widget.id === sectionId);
  return section?.config.appearance?.title?.trim() || t('dashboard.editor.sections.untitled_section');
}

function cardTitle(widgets: readonly DashboardWidget[], data: DragItemData, t: Translate): string {
  const section = widgets.find((widget) => widget.id === data?.sectionId);
  const cards = section?.config.extra?.cards;
  const card = Array.isArray(cards)
    ? cards.find((value): value is { id: string; title?: string } => Boolean(value) && typeof value === 'object' && value.id === data?.cardId)
    : undefined;
  return card?.title?.trim() || t('common.reorder_card');
}

/** What the person is moving, in words: the section title or the card title. */
export function describeDragItem(widgets: readonly DashboardWidget[], active: Pick<Active, 'id' | 'data'>, t: Translate): string {
  const data = active.data.current as DragItemData;
  return data?.kind === 'section-card' ? cardTitle(widgets, data, t) : sectionTitle(widgets, data?.sectionId ?? active.id, t);
}

/** Where it is hovering, in words: a numbered slot, a card inside its section, or a section. Never an internal id. */
export function describeDropTarget(widgets: readonly DashboardWidget[], over: Pick<Over, 'id' | 'data'>, t: Translate): string {
  const id = String(over.id);
  if (isSectionSlotId(id)) return t('common.reorder_slot', { position: Number(id.slice(SECTION_SLOT_PREFIX.length)) + 1 });
  const data = over.data.current as DragItemData;
  if (data?.kind === 'section-card') {
    return t('common.reorder_card_in', { card: cardTitle(widgets, data, t), section: sectionTitle(widgets, data.sectionId, t) });
  }
  return sectionTitle(widgets, data?.sectionId ?? over.id, t);
}

/** Screen-reader announcements for dashboard drag and drop, in the interface language. */
export function buildDragAnnouncements(widgets: readonly DashboardWidget[], t: Translate) {
  return {
    onDragStart: ({ active }: { active: Active }) => t('common.reorder_picked_up', { name: describeDragItem(widgets, active, t) }),
    onDragOver: ({ active, over }: { active: Active; over: Over | null }) => over
      ? t('common.reorder_over', { name: describeDragItem(widgets, active, t), target: describeDropTarget(widgets, over, t) })
      : undefined,
    onDragEnd: ({ active, over }: { active: Active; over: Over | null }) => over
      ? t('common.reorder_dropped', { name: describeDragItem(widgets, active, t), target: describeDropTarget(widgets, over, t) })
      : t('common.reorder_cancelled', { name: describeDragItem(widgets, active, t) }),
    onDragCancel: ({ active }: { active: Active }) => t('common.reorder_cancelled', { name: describeDragItem(widgets, active, t) }),
  };
}
