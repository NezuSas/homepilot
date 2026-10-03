import type { DashboardTab, DashboardWidget } from './types';

export type SectionLayout = NonNullable<DashboardTab['sectionLayout']>;
export type SectionLayoutKey = keyof SectionLayout;

export function availableSectionSlot(slots: Array<string | null>): number {
  const empty = slots.indexOf(null);
  return empty < 0 ? slots.length : empty;
}

export function sectionLayoutKey(columns: number): SectionLayoutKey {
  return `columns${Math.min(4, Math.max(1, columns))}` as SectionLayoutKey;
}

/** Legacy tabs start compact; sparse layouts preserve gaps and append new sections. */
export function resolveSectionSlots(widgets: DashboardWidget[], layout: SectionLayout | undefined, columns: number): Array<string | null> {
  const sections = widgets.filter((widget) => widget.type === 'section').map((widget) => widget.id);
  const valid = new Set(sections);
  const persisted = layout?.[sectionLayoutKey(columns)];
  if (!persisted) return sections;
  const seen = new Set<string>();
  const slots = persisted.slice(0, 200).map((id) => {
    if (!id || !valid.has(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
  for (const id of sections) if (!seen.has(id)) slots[availableSectionSlot(slots)] = id;
  return slots;
}

/** Empty target moves; occupied target swaps. Neither operation compacts gaps. */
export function moveSectionSlot(slots: Array<string | null>, sectionId: string, targetIndex: number): Array<string | null> {
  const sourceIndex = slots.indexOf(sectionId);
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= 200 || sourceIndex === targetIndex) return slots;
  const next = [...slots];
  while (next.length <= targetIndex) next.push(null);
  next[sourceIndex] = next[targetIndex];
  next[targetIndex] = sectionId;
  return next;
}
