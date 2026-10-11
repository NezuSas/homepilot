import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { availableSectionSlot, resolveSectionSlots, type SectionLayout } from '../sectionSlots';
import { readCanvasSections, projectCanvasSections } from '../dashboardSectionsAdapter';
import type { DashboardWidget } from '../types';
import { getSectionSpan, sanitizeWidget } from '../dashboardUtils';
import type { CanvasDragLayout } from './canvasTypes';
import { computeSlotCount, replaceBrokenSectionTitles } from './canvasLayout';

interface CanvasModelInput {
  widgets: DashboardWidget[];
  dragLayout: CanvasDragLayout | null;
  sectionLayout?: SectionLayout;
  columns: number;
  currentTabId?: string;
  isEditing: boolean;
  isDraggingSection: boolean;
}

/** Derives what the canvas renders (title, badge row, flow, section slots) from the widgets and the live drag layout. */
export function useCanvasModel({ widgets, dragLayout, sectionLayout, columns, currentTabId, isEditing, isDraggingSection }: CanvasModelInput) {
  const { t } = useTranslation();

  const sanitizedWidgets = useMemo(
    () => replaceBrokenSectionTitles((dragLayout?.widgets ?? widgets).map(sanitizeWidget), t('dashboard.editor.sections.new_section')),
    [dragLayout?.widgets, widgets, t],
  );

  const badgeWidget = sanitizedWidgets.find(widget => widget.type === 'section' && widget.config.extra?.badgeRow === true);
  const titleWidget = sanitizedWidgets.find((widget) => widget.type === 'dashboard_title') ?? null;
  const sectionModel = useMemo(() => readCanvasSections(sanitizedWidgets, currentTabId ?? 'preview'), [sanitizedWidgets, currentTabId]);
  // Everything that isn't the pinned title flows and reorders together,
  // Home Assistant "Sections" style: order in this array is visual order.
  const flowWidgets = useMemo(
    () => projectCanvasSections(sanitizedWidgets, sectionModel).filter((widget) => widget.type !== 'dashboard_title' && widget.config.extra?.badgeRow !== true),
    [sanitizedWidgets, sectionModel],
  );
  const flowWidgetIds = useMemo(() => flowWidgets.map((widget) => widget.id), [flowWidgets]);
  const sectionWidgets = useMemo(() => flowWidgets.filter((widget) => widget.type === 'section'), [flowWidgets]);
  const visibleSectionLayout = dragLayout?.layout ?? sectionLayout;
  const sectionSlots = useMemo(() => resolveSectionSlots(flowWidgets, visibleSectionLayout, columns), [flowWidgets, visibleSectionLayout, columns]);
  // All Sections render in one slot, including historical multitrack data.
  // Keep the sparse slot map authoritative wherever a profile was saved.
  const useSectionSlots = sectionWidgets.length > 0
    && sectionWidgets.every((widget) => getSectionSpan(widget) === 1);
  const slotCount = computeSlotCount({
    useSectionSlots,
    slotsLength: sectionSlots.length,
    editingFloor: isEditing ? availableSectionSlot(sectionSlots) + 1 : 0,
    columns,
    draggingSection: isDraggingSection,
  });
  const sectionById = useMemo(() => new Map(sectionWidgets.map((widget) => [widget.id, widget])), [sectionWidgets]);

  return { badgeWidget, titleWidget, flowWidgets, flowWidgetIds, sectionSlots, useSectionSlots, slotCount, sectionById };
}

export type CanvasModel = ReturnType<typeof useCanvasModel>;
