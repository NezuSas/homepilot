import { useContext, useMemo, useState } from 'react';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SectionCardDragContext, sectionCardDragId } from '../sectionCardDrag';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { SectionAddCardButton, SectionBadgeRow, SectionCardGrid, SectionHeading } from './SectionChrome';
import { useCardReorderMotion } from './useCardReorderMotion';
import ConfirmModal from '../../../components/ConfirmModal';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { getCatalogDescriptionKey, getCatalogLabelKey, getRecommendedSectionHeight, normalizeCards, normalizeKind, normalizeSensorScale, type CardDraft, type NormalizedSectionCardItem, type SectionCardCategory, type SectionCardKind } from './sectionCardCatalog';
import { useMasonryRowSpans } from './useMasonryRowSpans';
import { getAssignableRooms } from './sectionCardAssignments';
import { buildSectionCatalogItems, reorderSectionCards, resolveAssignableDevices, resolveSectionPlacedRows, resolveSelectedDraftEntities } from './sectionWidgetModel';
import { SectionCardItem } from './SectionCardItem';
import { SectionCardCatalogModal } from './SectionCardCatalogModal';
import { SectionCardEditorModal } from './SectionCardEditorModal';
import { useSectionCardActions } from './useSectionCardActions';
import { getDashboardIconComponent } from '../components/dashboardIconRegistry';
import { isDeviceOperational } from '../../../lib/deviceOperationalEligibility';
import { renderSectionCatalogPreview, type SectionCatalogPreviewArgs } from './SectionCatalogPreview';
import { applyDraftToCard, createCardFromCatalogItem, createDraftFromCard, createDraftFromNewCard, filterCatalogItems, getBoundRoutineIcon, type SectionCatalogItem } from './sectionCardEditing';
import { useAssignableSources } from './useAssignableSources';
import { useSectionGridWidth } from './useSectionGridWidth';

interface SectionWidgetProps {
  sectionId?: string;
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

export function SectionWidget({ config, isEditing, onUpdate, sectionId }: SectionWidgetProps) {
  const badgeRow = config.extra?.badgeRow === true;
  const { sectionGridRef, sectionGridWidth } = useSectionGridWidth();
  const { t } = useTranslation();
  const dragIdentities = useContext(SectionCardDragContext);
  const sharedDrag = Boolean(dragIdentities) && Boolean(sectionId);

  const catalogLabel = (kind: SectionCardKind) => t(getCatalogLabelKey(kind));
  const catalogDescription = (kind: SectionCardKind) => t(getCatalogDescriptionKey(kind));

  const devices = useDeviceSnapshotStore((state) => state.devices);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<SectionCardCategory | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const { rowSpans, registerCard } = useMasonryRowSpans();
  const cardDragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb', mediaVariant: 'premium' });
  const { processingCardId, actionFeedback, handleCardAction, handleMediaCardAction, executeSectionDeviceCommand } =
    useSectionCardActions({ devices, isEditing, upsertDevice });

  const assignableDevices = useMemo(() => {
    const available = devices.filter(device => isDeviceOperational(device, Object.values(roomsByHome).flat()));
    return resolveAssignableDevices(cardDraft.kind, available);
  }, [cardDraft.kind, devices, roomsByHome]);
  const assignableRooms = useMemo(() => getAssignableRooms(roomsByHome), [roomsByHome]);

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  useCardReorderMotion(sectionGridRef, cards.map((card) => card.id).join('|'));
  const hasRoutineAction = cards.some((card) => card.entityId && normalizeKind(card.kind) === 'action');
  const sectionIcon = config.appearance?.icon?.trim();
  const SectionIcon = sectionIcon ? getDashboardIconComponent(sectionIcon) : null;
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  const { scenes, automations, displayActions } = useAssignableSources({
    badgeRow,
    draftKind: cardDraft.kind,
    editingCardId,
    hasRoutineAction,
    isCatalogOpen,
  });

  const { device: selectedDevice, scene: selectedScene, automation: selectedAutomation, displayAction: selectedDisplayAction, room: selectedRoom } =
    resolveSelectedDraftEntities({ entityId: cardDraft.entityId, devices, scenes, automations, displayActions, rooms: assignableRooms });

  const catalogItems = buildSectionCatalogItems(badgeRow, (kind) => badgeRow ? t(`dashboard.editor.sections.${kind}`) : catalogLabel(kind), catalogDescription);

  const filteredCatalog = filterCatalogItems(catalogItems, catalogCategoryFilter, query);

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

  const addCard = (item: SectionCatalogItem) => {
    const nextCard = createCardFromCatalogItem(item);

    updateCards([...cards, nextCard]);
    setIsCatalogOpen(false);
    setQuery('');
    setCatalogCategoryFilter(null);

    setEditingCardId(nextCard.id);
    setCardDraft(createDraftFromNewCard(nextCard));
  };

  const openCardEditor = (card: NormalizedSectionCardItem) => {
    setEditingCardId(card.id);
    setCardDraft(createDraftFromCard(card));
  };

  const saveCardEditor = () => {
    if (!editingCard) return;
    const sensorScale = normalizeSensorScale({ min: cardDraft.sensorMin, max: cardDraft.sensorMax });
    if (cardDraft.kind === 'sensor' && (cardDraft.sensorMin !== undefined || cardDraft.sensorMax !== undefined) && !sensorScale) return;
    const labels = {
      fallbackTitle: selectedDisplayAction?.displayName || selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name || catalogLabel(cardDraft.kind),
      description: catalogDescription(cardDraft.kind),
      entityName: selectedDisplayAction?.deviceName || selectedScene?.name || selectedAutomation?.name || selectedRoom?.name || selectedDevice?.name,
    };
    updateCards(cards.map((card) => card.id === editingCard.id ? applyDraftToCard(card, cardDraft, sensorScale, labels) : card));
    setEditingCardId(null);
  };

  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const reordered = reorderSectionCards(cards, String(active.id), String(over.id));
    if (reordered) updateCards(reordered);
  };

  const previewContext = { badgeRow, devices, assignableRooms, scenes, automations, sectionGridWidth, editingCard, catalogLabel, catalogDescription };
  const renderCatalogPreview = (...args: SectionCatalogPreviewArgs) =>
    renderSectionCatalogPreview(previewContext, ...args);

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
      isBadgeRow={badgeRow}
      cardDraft={cardDraft}
      setCardDraft={setCardDraft}
      catalogLabel={catalogLabel}
      assignableDevices={assignableDevices}
      assignableRooms={assignableRooms}
      scenes={scenes}
      automations={automations}
      displayActions={displayActions.filter(action => devices.some(device => device.id === action.deviceId && isDeviceOperational(device, Object.values(roomsByHome).flat())))}
      devices={devices}
      sectionWidth={sectionGridWidth}
      renderCatalogPreview={renderCatalogPreview}
      onClose={() => setEditingCardId(null)}
      onDelete={() => setPendingDeleteId(editingCard.id)}
      onSave={saveCardEditor}
    />
  ) : null;

  const placedRows = resolveSectionPlacedRows(cards, isEditing, rowSpans);
  const sortableCards = (
    <SortableContext items={cards.map((card) => sharedDrag ? sectionCardDragId(sectionId!, card.id, dragIdentities) : card.id)} strategy={sharedDrag ? () => null : rectSortingStrategy}>
      {cards.filter(card => isEditing || !card.hidden).map((card) => (
        <SectionCardItem
          key={card.id}
          sectionId={sharedDrag ? sectionId : undefined}
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
          registerRowSpanRef={registerCard}
          rowSpan={rowSpans[card.id] ?? 1}
          placedRow={placedRows[card.id]}
        />
      ))}
    </SortableContext>
  );
  const sectionGrid = (
    <SectionCardGrid gridRef={sectionGridRef}>
      {sharedDrag ? sortableCards : <DndContext sensors={cardDragSensors} onDragEnd={handleCardDragEnd}>{sortableCards}</DndContext>}
    </SectionCardGrid>
  );
  const confirmDelete = () => {
    if (pendingDeleteId) updateCards(cards.filter((card) => card.id !== pendingDeleteId));
    setPendingDeleteId(null);
    setEditingCardId(null);
  };

  if (badgeRow) return (
    <SectionBadgeRow cards={cards} devices={devices} isEditing={isEditing} onEditCard={openCardEditor} onAdd={() => setIsCatalogOpen(true)}>
      {catalogModal}{editorModal}
      <ConfirmModal isOpen={pendingDeleteId !== null} title={t('common.delete')} description={t('common.delete')} onClose={() => setPendingDeleteId(null)} onConfirm={confirmDelete} />
    </SectionBadgeRow>
  );

  return (
    <section
      aria-label={title || t('dashboard.editor.sections.untitled_section')}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "relative flex w-full min-w-0 flex-col gap-3 overflow-visible px-5 pb-2 pt-3",
        isEditing && "group/section relative text-left",
      )}
    >
      <SectionHeading title={title} showTitle={showTitle} isEditing={isEditing} Icon={SectionIcon} />

      {sectionGrid}

      {isEditing ? <SectionAddCardButton onAdd={() => setIsCatalogOpen(true)} /> : null}

      {catalogModal}
      {editorModal}
      <ConfirmModal isOpen={pendingDeleteId !== null} title={t('common.delete')} description={t('common.delete')} confirmText={t('common.delete')} onClose={() => setPendingDeleteId(null)} onConfirm={confirmDelete} />
    </section>
  );
}
