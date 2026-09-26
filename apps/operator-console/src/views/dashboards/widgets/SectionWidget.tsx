import { useEffect, useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { cardKinds, createId, getCatalogCategory, getCatalogDescriptionKey, getCatalogLabelKey, getDefaultIcon, getDefaultSpan, getEffectiveCardSpan, getRecommendedSectionHeight, getWidgetType, isClockKind, normalizeCards, normalizeKind, type AssignableAutomation, type AssignableScene, type CardDraft, type NormalizedSectionCardItem, type NormalizedSectionCardKind, type SectionCardCategory, type SectionCardIcon, type SectionCardKind, type SectionCardSpan } from './sectionCardCatalog';
import { getAssignableDevicesForSectionCard, isDeviceActive } from '../dashboardUtils';
import { IconButton } from '../../../components/ui/IconButton';
import { useMasonryRowSpans } from './useMasonryRowSpans';
import { getAssignableRooms, isAutomationEntityId, normalizeAssignableAutomation, normalizeAssignableScene, stripAutomationEntityPrefix } from './sectionCardAssignments';
import { SectionCardContent } from './SectionCardContent';
import { SectionCardItem } from './SectionCardItem';
import { SectionCardCatalogModal } from './SectionCardCatalogModal';
import { SectionCardEditorModal } from './SectionCardEditorModal';
import { useSectionCardActions } from './useSectionCardActions';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();

  const catalogLabel = (kind: SectionCardKind) => t(getCatalogLabelKey(kind));

  const catalogDescription = (kind: SectionCardKind) => t(getCatalogDescriptionKey(kind));

  const devices = useDeviceSnapshotStore((state) => state.devices);
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
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb' });
  const [scenes, setScenes] = useState<AssignableScene[]>([]);
  const [automations, setAutomations] = useState<AssignableAutomation[]>([]);
  const { processingCardId, actionFeedback, handleCardAction, handleMediaCardAction, executeSectionDeviceCommand } =
    useSectionCardActions({ devices, isEditing, upsertDevice });

  const assignableDevices = useMemo(() => {
    const kind = normalizeKind(cardDraft.kind);
    if (kind !== 'light' && kind !== 'action') return getAssignableDevicesForSectionCard(kind, devices);
    const targets = new Map(
      [...getAssignableDevicesForSectionCard('light', devices), ...getAssignableDevicesForSectionCard('action', devices)]
        .map((device) => [device.id, device] as const),
    );
    return [...targets.values()].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [cardDraft.kind, devices]);
  const assignableRooms = useMemo(() => getAssignableRooms(roomsByHome), [roomsByHome]);
  const selectedDevice = cardDraft.entityId ? devices.find((device) => device.id === cardDraft.entityId) : undefined;
  const selectedScene = cardDraft.entityId && !isAutomationEntityId(cardDraft.entityId)
    ? scenes.find((scene) => scene.id === cardDraft.entityId)
    : undefined;
  const selectedAutomation = cardDraft.entityId && isAutomationEntityId(cardDraft.entityId)
    ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(cardDraft.entityId))
    : undefined;
  const selectedRoom = cardDraft.entityId ? assignableRooms.find((room) => room.id === cardDraft.entityId) : undefined;


  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  useEffect(() => {
    if (!isCatalogOpen && normalizeKind(cardDraft.kind) !== 'scene' && normalizeKind(cardDraft.kind) !== 'action' && normalizeKind(cardDraft.kind) !== 'light') return;

    let cancelled = false;
    void apiFetch(`${API_BASE_URL}/api/v1/scenes`)
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
        if (!cancelled) setScenes(nextScenes);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('[SectionWidget] Failed to load scenes:', error);
          setScenes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cardDraft.kind, isCatalogOpen]);

  useEffect(() => {
    if (!isCatalogOpen && normalizeKind(cardDraft.kind) !== 'scene' && normalizeKind(cardDraft.kind) !== 'action' && normalizeKind(cardDraft.kind) !== 'light') return;

    let cancelled = false;
    void apiFetch(`${API_BASE_URL}/api/v1/automations`)
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
        if (!cancelled) setAutomations(nextAutomations);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          console.error('[SectionWidget] Failed to load automations:', error);
          setAutomations([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cardDraft.kind, isCatalogOpen]);

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
    };

    updateCards([...cards, nextCard]);
    setIsCatalogOpen(false);
    setQuery('');
    setCatalogCategoryFilter(null);

    setEditingCardId(nextCard.id);
    const nextIcon = nextCard.icon ?? getDefaultIcon(nextCard.kind);
    setCardDraft({
      title: nextCard.title,
      kind: nextCard.kind,
      entityId: '',
      span: nextCard.span ?? getDefaultSpan(nextCard.kind),
      icon: nextIcon,
    });
  };

  const openCardEditor = (card: NormalizedSectionCardItem) => {
    setEditingCardId(card.id);
    const nextIcon = card.icon ?? getDefaultIcon(card.kind);
    setCardDraft({
      title: card.title,
      kind: card.kind,
      entityId: card.entityId || '',
      span: getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind)),
      icon: nextIcon,
    });
  };

  const saveCardEditor = () => {
    if (!editingCard) return;
    const nextCards = cards.map((card) => {
      if (card.id !== editingCard.id) return card;

      return {
        ...card,
        kind: cardDraft.kind,
        title: cardDraft.title.trim() || selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name || catalogLabel(cardDraft.kind),
        description: catalogDescription(cardDraft.kind),
        widgetType: getWidgetType(cardDraft.kind),
        entityId: cardDraft.entityId || undefined,
        entityName: selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name,
        span: isClockKind(cardDraft.kind) ? 'full' : getEffectiveCardSpan(cardDraft.kind, cardDraft.span),
        icon: cardDraft.icon,
      };
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
  ) => {
    const title = titleOverride || catalogLabel(kind);
    const span = getEffectiveCardSpan(kind, spanOverride ?? getDefaultSpan(kind));
    const normalizedPreviewKind = normalizeKind(kind);
    const isCameraPreview = normalizedPreviewKind === 'camera';
    const isClockPreview = isClockKind(normalizedPreviewKind);
    const isScenePreview = normalizedPreviewKind === 'scene';
    const isRoomPreview = normalizedPreviewKind === 'room';
    const isCoverPreview = normalizedPreviewKind === 'cover';
    const isLightPreview = normalizedPreviewKind === 'light';
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
        "grid overflow-hidden rounded-section bg-background/40 transition-[height,width,max-width] duration-200",
        span === 'small' && (normalizedPreviewKind === 'device' || normalizedPreviewKind === 'light' ? "h-device-card-compact w-device-card-compact justify-self-center" : "h-section-card-sm w-full max-w-[12rem] justify-self-center"),
        span === 'medium' && !isCoverPreview && "h-section-card-md w-full max-w-form-md",
        span === 'medium' && isCoverPreview && "h-curtain-card w-full max-w-form-md justify-self-center",
        span === 'full' && "w-full",
        isCameraPreview ? 'h-60' : isClockPreview ? 'h-56' : isRoomPreview ? 'h-52' : isScenePreview ? 'h-44' : isCoverPreview && span === 'full' ? 'h-curtain-card-lg' : normalizedPreviewKind === 'media' ? 'h-media-card-preview' : span === 'full' ? 'h-40' : ''
      )}>
        <SectionCardContent
          kind={kind}
          title={title}
          subtitle={normalizedPreviewKind === 'cover' ? previewRoomName || catalogDescription(kind) : catalogDescription(kind)}
          span={span}
          icon={iconOverride ?? getDefaultIcon(kind)}
          isAssigned={Boolean(deviceIdOverride)}
          isActive={previewDevice ? isDeviceActive(previewDevice) : isLightPreview}
          deviceId={deviceIdOverride}
          device={previewDevice}
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

  const editorModal = editingCard ? (
    <SectionCardEditorModal
      cardDraft={cardDraft}
      setCardDraft={setCardDraft}
      catalogLabel={catalogLabel}
      assignableDevices={assignableDevices}
      assignableRooms={assignableRooms}
      scenes={scenes}
      automations={automations}
      devices={devices}
      renderCatalogPreview={renderCatalogPreview}
      onClose={() => setEditingCardId(null)}
      onSave={saveCardEditor}
    />
  ) : null;

  const sectionGrid = (
    <div
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "grid min-h-0 min-w-0 flex-1 grid-cols-2 content-start items-start gap-2 overflow-visible pr-1 sm:grid-cols-4",
        isEditing
          ? "auto-rows-auto grid-flow-row"
          : "auto-rows-[minmax(20px,auto)] grid-flow-row-dense"
      )}

    >
      <DndContext sensors={cardDragSensors} onDragEnd={handleCardDragEnd}>
        <SortableContext items={cards.map((card) => card.id)} strategy={rectSortingStrategy}>
          {cards.map((card) => (
            <SectionCardItem
              key={card.id}
              card={card}
              isEditing={isEditing}
              devices={devices}
              roomsByHome={roomsByHome}
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

      {isEditing ? (
        <IconButton
          icon={Plus}
          label={t('dashboard.editor.sections.add_card')}
          variant="ghost"
          size="lg"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "h-device-card-compact w-full rounded-section border-2 border-dashed border-primary/75 bg-background/35 text-primary hover:bg-primary/10 [&>svg]:h-5 [&>svg]:w-5",
            "col-span-1"
          )}
        />
      ) : null}
    </div>
  );

  if (!isEditing) {
    return (
      <section
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full min-w-0 flex-col gap-3 overflow-visible px-1 pb-2 pt-1"
      >
        {showTitle ? (
          <h2 className="min-w-0 truncate text-dashboard-section-title-fluid font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}

        {sectionGrid}

        {catalogModal}
        {editorModal}
      </section>
    );
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="group/section relative flex min-h-fit w-full min-w-0 self-start flex-col overflow-visible px-1 pb-2 pt-1 text-left"
    >
      <div className="mb-4 flex min-w-0 items-center gap-2">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-dashboard-section-title-fluid font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : (
          <span className="text-body font-semibold text-muted-foreground">
            {t('dashboard.editor.sections.untitled_section')}
          </span>
        )}
      </div>

      {sectionGrid}

      {catalogModal}
      {editorModal}
    </div>
  );
}
