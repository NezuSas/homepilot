import { DndContext } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { SectionCardDragContext } from './sectionCardDrag';
import { availableSectionSlot, type SectionLayout } from './sectionSlots';
import { Button } from '../../components/ui/Button';
import { SurfaceButton } from '../../components/ui/SurfaceButton';
import { generateId } from '../../utils/generateId';
import { createDefaultWidgetConfig } from './dashboardMutations';
import { SectionWidget } from './widgets/SectionWidget';
import ConfirmModal from '../../components/ConfirmModal';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { DashboardWidgetNode } from './DashboardWidget';
import { CANVAS_ROW_UNIT, duplicateSectionWidgets } from './canvas/canvasLayout';
import { canvasCollisionDetection } from './canvas/canvasCollision';
import { CanvasDragOverlay } from './canvas/CanvasDragOverlay';
import { CanvasFlowItem } from './canvas/CanvasFlowItem';
import { SectionDropSlot } from './canvas/SectionDropSlot';
import { SortableCanvasWidget } from './canvas/SortableCanvasWidget';
import { useCanvasDragHandlers } from './canvas/useCanvasDragHandlers';
import { useCanvasDragState } from './canvas/useCanvasDragState';
import { useCanvasModel } from './canvas/useCanvasModel';
import { useCanvasSensors } from './canvas/useCanvasSensors';
import { useCanvasViewport } from './canvas/useCanvasViewport';

interface DashboardCanvasProps {
  maxColumns?: number;
  widgets: DashboardWidget[];
  isEditing: boolean;
  onWidgetClick: (id: string) => void;
  selectedWidgetId: string | null;
  sectionLayout?: SectionLayout;
  onLayoutChange: (widgets: DashboardWidget[], sectionLayout?: SectionLayout) => void;
  onWidgetConfigChange?: (widgetId: string, config: Partial<DashboardWidgetConfig>) => void;
  onAddSectionClick?: () => void;
  onAddTitleClick?: () => void;
  /** Other tabs of this dashboard, used by the title widget's tab-link badges. */
  tabs?: Array<{ id: string; title: string; icon?: string }>;
  currentTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export function DashboardCanvas({
  maxColumns = 4,
  widgets,
  isEditing,
  onWidgetClick,
  selectedWidgetId,
  onLayoutChange, sectionLayout, onWidgetConfigChange, onAddSectionClick, onAddTitleClick,
  tabs, currentTabId, onSelectTab }: DashboardCanvasProps) {
  const { t } = useTranslation();
  const [pendingDeleteWidgetId, setPendingDeleteWidgetId] = useState<string | null>(null);
  const { containerRef, columns, gap, isPortraitKiosk } = useCanvasViewport(maxColumns);
  // Editing (reorder + span) is available at every breakpoint: the flow model
  // no longer needs a desktop-only coordinate system to stay coherent.
  const canEditLayout = isEditing;
  const drag = useCanvasDragState(containerRef);
  const { activeWidget, cardDragIdentities, dragLayout, dragPreview, dragSession } = drag;
  const model = useCanvasModel({
    widgets, dragLayout, sectionLayout, columns, currentTabId, isEditing,
    isDraggingSection: activeWidget?.type === 'section',
  });
  const { badgeWidget, titleWidget, flowWidgets, flowWidgetIds, sectionSlots, useSectionSlots, slotCount, sectionById } = model;

  const createBadgeRow = () => {
    const config = createDefaultWidgetConfig('section', undefined, { titleArea: '', newSection: '', titlePlaceholder: '', subtitlePlaceholder: '' });
    onLayoutChange([...widgets, { id: generateId(), type: 'section', config: { ...config, appearance: { ...config.appearance, showTitle: false }, extra: { ...config.extra, badgeRow: true, cards: [] } } }], sectionLayout);
  };
  const duplicateSection = (id: string) => {
    const duplicated = duplicateSectionWidgets(widgets, id, generateId);
    if (duplicated) onLayoutChange(duplicated);
  };

  const sensors = useCanvasSensors(useSectionSlots);
  const { handleDragStart, handleDragOver, handleDragEnd, handleDragCancel } = useCanvasDragHandlers({
    canEditLayout, widgets, sectionLayout, columns, containerRef, drag, model, onLayoutChange,
  });

  const pendingDeleteWidget = pendingDeleteWidgetId
    ? widgets.find((widget) => widget.id === pendingDeleteWidgetId) ?? null
    : null;

  const addSectionControl = canEditLayout ? <SurfaceButton
    type="button" onClick={onAddSectionClick}
    aria-label={t('dashboard.editor.sections.add_section')}
    className="min-h-36 w-full rounded-field border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
  ><span aria-hidden="true" className="text-panel-title font-light">+</span></SurfaceButton> : null;

  return (
    <DndContext
      accessibility={{ announcements: {
        onDragStart: () => t('common.reorder'),
        onDragEnd: () => t('common.done'),
        onDragCancel: () => t('common.cancel'),
        onDragOver: ({ active, over }) => {
          if (!over) return;
          const sectionId = active.data.current?.kind === 'section-card'
            ? dragSession.current?.sourceSectionId : over.data.current?.sectionId;
          const section = widgets.find(widget => widget.id === sectionId);
          return `${t('common.reorder')}: ${section?.config.appearance?.title || String(over.id)}`;
        },
      } }}
      sensors={sensors}
      collisionDetection={canvasCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
    >
      <SectionCardDragContext.Provider value={cardDragIdentities}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full grid min-w-0 overflow-x-hidden",
          isPortraitKiosk && "homepilot-portrait-kiosk-canvas",
          isEditing
            ? "bg-transparent"
            : "bg-transparent"
        )}
        style={{
          // The measured, maxColumns-clamped count is shared by both modes
          // and the slot profiles. Explicit tracks preserve empty columns;
          // minmax(0, 1fr) prevents content from widening the mobile canvas.
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: `${CANVAS_ROW_UNIT}px`,
            gridAutoFlow: 'row dense',
          alignItems: 'start',
          gap: `${gap}px`,
        }}
      >
        {titleWidget ? (
          <CanvasFlowItem span={columns} gap={gap}>
            <DashboardWidgetNode
              widget={titleWidget}
              isEditing={isEditing}
              canDrag={false}
              isSelected={isEditing && selectedWidgetId === titleWidget.id}
              onClick={() => { if (isEditing) onWidgetClick(titleWidget.id); }}
              onConfigChange={onWidgetConfigChange}
              onDelete={setPendingDeleteWidgetId}
              titleBadgeTabs={tabs}
              currentTabId={currentTabId}
              onSelectTab={onSelectTab}
            />
          </CanvasFlowItem>
        ) : canEditLayout ? <CanvasFlowItem span={columns} gap={gap}>
          <Button type="button" variant="outline" size="md" onClick={onAddTitleClick}>{t('dashboard.editor.sections.add_title')}</Button>
        </CanvasFlowItem> : null}

        {badgeWidget ? <CanvasFlowItem span={columns} gap={gap}><SectionWidget sectionId={badgeWidget.id} config={badgeWidget.config} isEditing={isEditing} onUpdate={config => onWidgetConfigChange?.(badgeWidget.id, config)} /></CanvasFlowItem>
          : canEditLayout ? <CanvasFlowItem span={columns} gap={gap}><Button variant="ghost" className="border border-dashed border-border text-muted-foreground" onClick={createBadgeRow}><Plus className="size-4" aria-hidden="true" />{t('dashboard.editor.sections.add_labels')}</Button></CanvasFlowItem> : null}

        {useSectionSlots && <CanvasFlowItem span={columns} gap={gap}>
          <SortableContext items={sectionSlots.filter((id): id is string => id !== null)} strategy={rectSortingStrategy}>
            <div className="grid min-w-0 items-start" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${CANVAS_ROW_UNIT}px`, gridAutoFlow: 'row dense', gap: `${gap}px` }}>
              {Array.from({ length: slotCount }, (_, index) => {
                const widget = sectionById.get(sectionSlots[index] ?? '');
                return <SectionDropSlot
                  key={index}
                  index={index}
                  columns={columns}
                  gap={gap}
                  editing={isEditing}
                  hasContent={Boolean(widget) || Boolean(!widget && index === availableSectionSlot(sectionSlots) && addSectionControl)}
                >
                  {!widget && index === availableSectionSlot(sectionSlots) && addSectionControl}
                  {widget && <SortableCanvasWidget
                    key={widget.id}
                    widget={widget} columns={columns} gap={gap} slotMode
                    isEditing={isEditing} canDrag={canEditLayout}
                    isSelected={selectedWidgetId === widget.id}
                    onClick={onWidgetClick} onConfigChange={onWidgetConfigChange}
                    onDelete={setPendingDeleteWidgetId}
                    onDuplicate={duplicateSection}
                  />}
                </SectionDropSlot>;
              })}
            </div>
          </SortableContext>
        </CanvasFlowItem>}
        <SortableContext items={useSectionSlots ? flowWidgetIds.filter((id) => !sectionById.has(id)) : flowWidgetIds} strategy={rectSortingStrategy}>
          {flowWidgets.filter((widget) => !useSectionSlots || widget.type !== 'section').map((widget) => (
            <SortableCanvasWidget
              key={widget.id}
              widget={widget}
              columns={columns}
              gap={gap}
              isEditing={isEditing}
              canDrag={canEditLayout}
              isSelected={selectedWidgetId === widget.id}
              onClick={onWidgetClick}
              onConfigChange={onWidgetConfigChange}
              onDelete={setPendingDeleteWidgetId}
              onDuplicate={duplicateSection}
            />
          ))}
        </SortableContext>

        {!useSectionSlots && addSectionControl && <CanvasFlowItem span={1} gap={gap}>{addSectionControl}</CanvasFlowItem>}

        <ConfirmModal
          isOpen={pendingDeleteWidgetId !== null}
          onClose={() => setPendingDeleteWidgetId(null)}
          onConfirm={() => {
            if (pendingDeleteWidgetId) {
              onLayoutChange(widgets.filter((candidate) => candidate.id !== pendingDeleteWidgetId));
            }
            setPendingDeleteWidgetId(null);
          }}
          title={t(pendingDeleteWidget?.type === 'dashboard_title' ? 'dashboards.delete_title_title' : 'common.delete')}
          description={t(pendingDeleteWidget?.type === 'dashboard_title' ? 'dashboards.delete_title_description' : 'dashboards.delete_tab_confirm')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />
        <CanvasDragOverlay canEditLayout={canEditLayout} dragPreview={dragPreview} activeWidget={activeWidget} />
      </div>
      </SectionCardDragContext.Provider>
    </DndContext>
  );
}
