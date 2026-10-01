import { useEffect, useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { API_BASE_URL } from '../../../config';
import { fetchDiagnosticResource } from '../../../lib/diagnosticResourceRequests';
import { apiFetch } from '../../../lib/apiClient';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { cardKinds, createId, getCatalogCategory, getCatalogDescriptionKey, getCatalogLabelKey, getDefaultIcon, getDefaultSpan, getEffectiveCardSpan, getRecommendedSectionHeight, getWidgetType, isClockKind, normalizeCards, normalizeKind, normalizeMediaVariant, type AssignableAutomation, type AssignableDisplayAction, type AssignableScene, type CardDraft, type MediaVariant, type NormalizedSectionCardItem, type NormalizedSectionCardKind, type SectionCardCategory, type SectionCardIcon, type SectionCardKind, type SectionCardSpan } from './sectionCardCatalog';
import { getAssignableDevicesForSectionCard, isDeviceActive } from '../dashboardUtils';
import { Button } from '../../../components/ui/Button';
import { useMasonryRowSpans } from './useMasonryRowSpans';
import { getAssignableRooms, isAutomationEntityId, normalizeAssignableAutomation, normalizeAssignableDisplayAction, normalizeAssignableScene, stripAutomationEntityPrefix, toDeviceActionEntityId } from './sectionCardAssignments';
import { SectionCardContent } from './SectionCardContent';
import { SectionCardItem } from './SectionCardItem';
import { SectionCardCatalogModal } from './SectionCardCatalogModal';
import { SectionCardEditorModal } from './SectionCardEditorModal';
import { useSectionCardActions } from './useSectionCardActions';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { isDeviceOperational } from '../../../lib/deviceOperationalEligibility';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

function getBoundRoutineIcon(entityId: string | undefined, scenes: AssignableScene[], automations: AssignableAutomation[]): string | undefined {
  if (!entityId) return undefined;
  if (isAutomationEntityId(entityId)) {
    const automation = automations.find((item) => item.id === stripAutomationEntityPrefix(entityId));
    return automation ? automation.icon ?? 'mdi:robot' : undefined;
  }
  const scene = scenes.find((item) => item.id === entityId);
  return scene ? scene.icon ?? 'mdi:auto-fix' : undefined;
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();

  const catalogLabel = (kind: SectionCardKind) => t(getCatalogLabelKey(kind));

  const catalogDescription = (kind: SectionCardKind) => t(getCatalogDescriptionKey(kind));

  const devices = useDeviceSnapshotStore((state) => state.devices);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<SectionCardCategory | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const { rowSpans, registerCard } = useMasonryRowSpans();
  const cardDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb', mediaVariant: 'premium' });
  const [scenes, setScenes] = useState<AssignableScene[]>([]);
  const [automations, setAutomations] = useState<AssignableAutomation[]>([]);
  const [displayActions, setDisplayActions] = useState<AssignableDisplayAction[]>([]);
  const { processingCardId, actionFeedback, handleCardAction, handleMediaCardAction, executeSectionDeviceCommand } =
    useSectionCardActions({ devices, isEditing, upsertDevice });

  const assignableDevices = useMemo(() => {
    const available = devices.filter(device => isDeviceOperational(device, Object.values(roomsByHome).flat()));
    const kind = normalizeKind(cardDraft.kind);
    if (kind !== 'light' && kind !== 'action') return getAssignableDevicesForSectionCard(kind, available);
    const targets = new Map(
      [...getAssignableDevicesForSectionCard('light', available), ...getAssignableDevicesForSectionCard('action', available)]
        .map((device) => [device.id, device] as const),
    );
    return [...targets.values()].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [cardDraft.kind, devices, roomsByHome]);
  const assignableRooms = useMemo(() => getAssignableRooms(roomsByHome), [roomsByHome]);
  const selectedDevice = cardDraft.entityId ? devices.find((device) => device.id === cardDraft.entityId) : undefined;
  const selectedScene = cardDraft.entityId && !isAutomationEntityId(cardDraft.entityId)
    ? scenes.find((scene) => scene.id === cardDraft.entityId)
    : undefined;
  const selectedAutomation = cardDraft.entityId && isAutomationEntityId(cardDraft.entityId)
    ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(cardDraft.entityId))
    : undefined;
  const selectedDisplayAction = displayActions.find((action) =>
    toDeviceActionEntityId(action.deviceId, action.actionKey) === cardDraft.entityId);
  const selectedRoom = cardDraft.entityId ? assignableRooms.find((room) => room.id === cardDraft.entityId) : undefined;


  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  const hasRoutineAction = cards.some((card) => card.entityId && normalizeKind(card.kind) === 'action');
  const sectionIcon = config.appearance?.icon?.trim();
  const SectionIcon = sectionIcon ? getDashboardIconComponent(sectionIcon) : null;
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  useEffect(() => {
    if (!hasRoutineAction && !isCatalogOpen && (!editingCardId || (normalizeKind(cardDraft.kind) !== 'scene' && normalizeKind(cardDraft.kind) !== 'action' && normalizeKind(cardDraft.kind) !== 'light'))) return;

    const controller = new AbortController();
    void fetchDiagnosticResource(`${API_BASE_URL}/api/v1/scenes`, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw new Error(`SCENES_${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
          .map(normalizeAssignableScene)
          .filter((scene): scene is AssignableScene => Boolean(scene))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
      })
      .then((nextScenes) => {
        if (!controller.signal.aborted) setScenes(nextScenes);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('[SectionWidget] Failed to load scenes:', error);
          setScenes([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [cardDraft.kind, editingCardId, hasRoutineAction, isCatalogOpen]);

  useEffect(() => {
    if (!editingCardId || (normalizeKind(cardDraft.kind) !== 'action' && normalizeKind(cardDraft.kind) !== 'light')) return;
    const controller = new AbortController();
    void apiFetch(`${API_BASE_URL}/api/v1/dashboard-action-targets`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('DASHBOARD_ACTION_TARGETS_UNAVAILABLE');
        const payload: unknown = await response.json();
        return Array.isArray(payload)
          ? payload.map(normalizeAssignableDisplayAction).filter((action): action is AssignableDisplayAction => action !== null)
          : [];
      }).then((actions) => { if (!controller.signal.aborted) setDisplayActions(actions); })
      .catch(() => { if (!controller.signal.aborted) setDisplayActions([]); });
    return () => controller.abort();
  }, [cardDraft.kind, editingCardId]);

  useEffect(() => {
    if (!hasRoutineAction && !isCatalogOpen && (!editingCardId || (normalizeKind(cardDraft.kind) !== 'scene' && normalizeKind(cardDraft.kind) !== 'action' && normalizeKind(cardDraft.kind) !== 'light'))) return;

    const controller = new AbortController();
    void fetchDiagnosticResource(`${API_BASE_URL}/api/v1/automations`, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw new Error(`AUTOMATIONS_${response.status}`);
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return [];
        return payload
          .map(normalizeAssignableAutomation)
          .filter((automation): automation is AssignableAutomation => Boolean(automation))
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
      })
      .then((nextAutomations) => {
        if (!controller.signal.aborted) setAutomations(nextAutomations);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('[SectionWidget] Failed to load automations:', error);
          setAutomations([]);
        }
      });

    return () => {
      controller.abort();
    };
  }, [cardDraft.kind, editingCardId, hasRoutineAction, isCatalogOpen]);

  const catalogItems = cardKinds.map((kind) => ({
    kind,
    title: catalogLabel(kind),
    description: catalogDescription(kind),
    widgetType: getWidgetType(kind),
    span: getDefaultSpan(kind),
    icon: getDefaultIcon(kind),
  }));

  const filteredCatalog = catalogItems.filter((item) => {
    if (catalogCategoryFilter && getCatalogCategory(item.kind) !== catalogCategoryFilter) return false;

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return `${item.title} ${item.description}`.toLowerCase().includes(normalizedQuery);
  });

const updateCards = (nextCards: NormalizedSectionCardItem[]) => {
    onUpdate?.({
      layout: {
        ...config.layout,
        h: getRecommendedSectionHeight(config.layout.h, nextCards),
      },
      extra: {
        ...config.extra,
        cards: nextCards,
      },
    });
  };

  const addCard = (item: typeof catalogItems[number]) => {
    const nextCard: NormalizedSectionCardItem = {
      id: createId(),
      kind: item.kind,
      title: item.title,
      description: item.description,
      widgetType: item.widgetType,
      span: item.span,
      icon: item.icon,
      ...(item.kind === 'media' ? { mediaVariant: 'premium' as const } : {}),
    };

    updateCards([...cards, nextCard]);
    setIsCatalogOpen(false);
    setQuery('');
    setCatalogCategoryFilter(null);

    if (!isClockKind(nextCard.kind)) {
      setEditingCardId(nextCard.id);
      const nextIcon = nextCard.icon ?? getDefaultIcon(nextCard.kind);
      setCardDraft({
        title: nextCard.title,
        kind: nextCard.kind,
        entityId: '',
        span: nextCard.span ?? getDefaultSpan(nextCard.kind),
        icon: nextIcon,
        mediaVariant: normalizeMediaVariant(nextCard.mediaVariant),
      });
    } else {
      setEditingCardId(null);
    }
  };

  const openCardEditor = (card: NormalizedSectionCardItem) => {
    if (isClockKind(card.kind)) return;
    setEditingCardId(card.id);
    const nextIcon = card.icon ?? getDefaultIcon(card.kind);
    setCardDraft({
      title: card.title,
      kind: card.kind,
      entityId: card.entityId || '',
      span: getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind)),
      icon: nextIcon,
      mediaVariant: normalizeMediaVariant(card.mediaVariant),
    });
  };

  const saveCardEditor = () => {
    if (!editingCard) return;
    const nextCards = cards.map((card) => {
      if (card.id !== editingCard.id) return card;

      const updatedCard: NormalizedSectionCardItem = {
        ...card,
        kind: cardDraft.kind,
        title: cardDraft.title.trim() || selectedDisplayAction?.displayName || selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name || catalogLabel(cardDraft.kind),
        description: catalogDescription(cardDraft.kind),
        widgetType: getWidgetType(cardDraft.kind),
        entityId: cardDraft.entityId || undefined,
        entityName: selectedDisplayAction?.deviceName || selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name,
        span: isClockKind(cardDraft.kind) ? 'full' : getEffectiveCardSpan(cardDraft.kind, cardDraft.span),
        icon: cardDraft.icon,
      };
      if (cardDraft.kind === 'media') updatedCard.mediaVariant = cardDraft.mediaVariant;
      else delete updatedCard.mediaVariant;
      return updatedCard;
    });

    updateCards(nextCards);
    setEditingCardId(null);
  };

  const removeCard = (id: string) => {
    updateCards(cards.filter((card) => card.id !== id));
  };

  const reorderCards = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const sourceIndex = cards.findIndex((card) => card.id === sourceId);
    const targetIndex = cards.findIndex((card) => card.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    updateCards(arrayMove(cards, sourceIndex, targetIndex));
  };

  const resizeCard = (cardId: string, nextSpan: SectionCardSpan) => {
    updateCards(cards.map((card) => (
      card.id === cardId ? { ...card, span: getEffectiveCardSpan(card.kind, nextSpan) } : card
    )));
  };

  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderCards(String(active.id), String(over.id));
  };

  const renderCatalogPreview = (
    kind: NormalizedSectionCardKind,
    titleOverride?: string,
    spanOverride?: SectionCardSpan,
    iconOverride?: SectionCardIcon,
    deviceIdOverride?: string,
    isEditorPreview = false,
    mediaVariantOverride?: MediaVariant,
  ) => {
    const title = titleOverride || catalogLabel(kind);
    const span = getEffectiveCardSpan(kind, spanOverride ?? getDefaultSpan(kind));
    const normalizedPreviewKind = normalizeKind(kind);
    const isCameraPreview = normalizedPreviewKind === 'camera';
    const isClockPreview = isClockKind(normalizedPreviewKind);
    const isScenePreview = normalizedPreviewKind === 'scene';
    const isRoomPreview = normalizedPreviewKind === 'room';
    const isCoverPreview = normalizedPreviewKind === 'cover';
    const roomDevices = isRoomPreview && deviceIdOverride
      ? devices.filter((device) => device.roomId === deviceIdOverride)
      : [];
    const previewDevice = deviceIdOverride
      ? devices.find((device) => device.id === deviceIdOverride)
      : undefined;
    const previewRoomName = previewDevice?.roomId
      ? assignableRooms.find((room) => room.id === previewDevice.roomId)?.name
      : undefined;

    return (
      <div className={cn(
        "grid overflow-hidden rounded-section transition-[height,width,max-width] duration-200",
        !isClockPreview && "bg-background/40",
        isClockPreview && (isEditorPreview ? 'homepilot-clock-preview-host homepilot-clock-preview-host--editor' : 'homepilot-clock-preview-host homepilot-clock-preview-host--catalog'),
        span === 'small' && (normalizedPreviewKind === 'device' || normalizedPreviewKind === 'light' || normalizedPreviewKind === 'action' ? "h-device-card-compact w-device-card-compact justify-self-center" : "h-section-card-sm w-full max-w-[12rem] justify-self-center"),
        span === 'medium' && !isCoverPreview && "h-section-card-md w-full max-w-form-md",
        span === 'medium' && isCoverPreview && "h-curtain-card w-full max-w-form-md justify-self-center",
        span === 'full' && "w-full",
        isCameraPreview ? 'min-h-60' : isClockPreview ? '' : isRoomPreview ? 'h-52' : isScenePreview ? 'h-44' : isCoverPreview && span === 'full' ? 'h-curtain-card-lg' : normalizedPreviewKind === 'media' ? 'h-media-card-preview' : span === 'full' ? 'h-40' : ''
      )}>
        <SectionCardContent
          kind={kind}
          title={title}
          subtitle={normalizedPreviewKind === 'cover' ? previewRoomName || catalogDescription(kind) : catalogDescription(kind)}
          span={span}
          icon={(normalizedPreviewKind === 'action' ? getBoundRoutineIcon(deviceIdOverride, scenes, automations) : undefined) ?? iconOverride ?? getDefaultIcon(kind)}
          isAssigned={Boolean(deviceIdOverride)}
          isActive={previewDevice ? isDeviceActive(previewDevice) : false}
          device={previewDevice}
          mediaVariant={mediaVariantOverride}
          isPreview={true}
          roomDeviceCount={roomDevices.length}
          roomActiveCount={roomDevices.filter(isDeviceActive).length}
        />
      </div>
    );
  };

  const catalogModal = isCatalogOpen ? (
    <SectionCardCatalogModal
      query={query}
      onQueryChange={setQuery}
      categoryFilter={catalogCategoryFilter}
      onFilterChange={setCatalogCategoryFilter}
      items={filteredCatalog}
      onSelect={addCard}
      onClose={() => setIsCatalogOpen(false)}
      renderCatalogPreview={renderCatalogPreview}
    />
  ) : null;

  const editorModal = editingCard && !isClockKind(editingCard.kind) ? (
    <SectionCardEditorModal
      cardDraft={cardDraft}
      setCardDraft={setCardDraft}
      catalogLabel={catalogLabel}
      assignableDevices={assignableDevices}
      assignableRooms={assignableRooms}
      scenes={scenes}
      automations={automations}
      displayActions={displayActions.filter(action => devices.some(device => device.id === action.deviceId && isDeviceOperational(device, Object.values(roomsByHome).flat())))}
      devices={devices}
      renderCatalogPreview={renderCatalogPreview}
      onClose={() => setEditingCardId(null)}
      onSave={saveCardEditor}
    />
  ) : null;

  const sectionGrid = (
    <div
      onClick={(event) => event.stopPropagation()}
      className="grid min-h-0 min-w-0 flex-1 grid-cols-2 content-start items-start gap-2 overflow-visible pr-1 sm:grid-cols-4 auto-rows-[minmax(20px,auto)] grid-flow-row-dense"
    >
      <DndContext sensors={cardDragSensors} onDragEnd={handleCardDragEnd}>
        <SortableContext items={cards.map((card) => card.id)} strategy={rectSortingStrategy}>
          {cards.map((card) => (
            <SectionCardItem
              key={card.id}
              card={card}
              actionIcon={normalizeKind(card.kind) === 'action' ? getBoundRoutineIcon(card.entityId, scenes, automations) : undefined}
              isEditing={isEditing}
              devices={devices}
              roomsByHome={roomsByHome}
              snapshotPending={snapshotLoading && devices.length === 0}
              processingCardId={processingCardId}
              actionFeedback={actionFeedback}
              catalogLabel={catalogLabel}
              handleCardAction={handleCardAction}
              handleMediaCardAction={handleMediaCardAction}
              executeSectionDeviceCommand={executeSectionDeviceCommand}
              upsertDevice={upsertDevice}
              openCardEditor={openCardEditor}
              removeCard={removeCard}
              resizeCard={resizeCard}
              registerRowSpanRef={registerCard}
              rowSpan={rowSpans[card.id] ?? 1}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );

  return (
    <section
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "flex h-full w-full min-w-0 flex-col gap-3 overflow-visible px-5 pb-2 pt-3",
        isEditing && "group/section relative text-left",
      )}
    >
      {showTitle ? (
        <h2 className="homepilot-dashboard-section-heading flex w-fit max-w-full items-center gap-2 truncate rounded-lg px-2 py-1 text-dashboard-section-title-fluid font-black tracking-tight">
          {SectionIcon && <SectionIcon className="homepilot-dashboard-section-heading-icon h-5 w-5 shrink-0" />}
          <span className="truncate">{title}</span>
        </h2>
      ) : isEditing ? (
        <span className="pointer-events-none absolute -top-5 left-1 text-body font-semibold text-muted-foreground">
          {t('dashboard.editor.sections.untitled_section')}
        </span>
      ) : null}

      {sectionGrid}

      {isEditing ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('dashboard.editor.sections.add_card')}
            onClick={(event) => {
              event.stopPropagation();
              setIsCatalogOpen(true);
            }}
            className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/50 bg-background/40 p-2 text-center text-primary hover:border-primary hover:bg-primary/10"
          >
            <Plus aria-hidden="true" className="h-5 w-5" />
            <span className="text-micro font-semibold">{t('dashboard.editor.sections.add_card')}</span>
          </Button>
        </div>
      ) : null}

      {catalogModal}
      {editorModal}
    </section>
  );
}
