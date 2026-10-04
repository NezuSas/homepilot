import { useContext, useEffect, useState, useRef, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SectionCardDragContext, sectionCardDragId, DASHBOARD_DRAG_TRANSITION } from '../sectionCardDrag';
import { Loader2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { type SnapshotDevice, type SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { isDeviceActive } from '../dashboardUtils';
import { isMomentaryPlcCommand } from '../../../lib/plcUi';
import { IconButton } from '../../../components/ui/IconButton';
import { CurtainDeviceTileLoadingGeometry } from '../../../components/CurtainDeviceTile';
import type { MediaPlayerCommand } from './MediaPlayerCard';
import { MASONRY_ROW_GAP_PX, MASONRY_ROW_UNIT_PX } from './useMasonryRowSpans';
import { SectionCardContent } from './SectionCardContent';
import { InformationCardSkeleton } from './InformationCard';
import { getCardFrameClass, getCardGridHeight, getCardGridRowSpan, getCardPresentationStyle } from './cardGridResize';
import { DashboardCardSkeleton, type DashboardCardSkeletonVariant } from '../../../components/ui/DashboardCardSkeleton';
import { needsInitialDashboardSkeleton, useDelayedSkeleton } from '../../../components/ui/useDashboardDelayedSkeleton';
import {
  getDefaultSpan, getEffectiveCardSpan, getSpanClass,
  isClockKind, normalizeKind, type NormalizedSectionCardItem,
  type SectionCardKind,
} from './sectionCardCatalog';

// Compact tiles share a minimum masonry row span despite title wrapping.
const COMPACT_TILE_ROW_SPAN = Math.ceil((96 + MASONRY_ROW_GAP_PX) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX));

export function SectionCardItem({
  card,
  sectionId,
  actionIcon,
  isEditing,
  devices,
  roomsByHome,
  snapshotPending,
  processingCardId,
  actionFeedback,
  catalogLabel,
  handleCardAction,
  handleMediaCardAction,
  executeSectionDeviceCommand,
  upsertDevice,
  openCardEditor,
  registerRowSpanRef,
  rowSpan,
  placedRow,
}: {
  card: NormalizedSectionCardItem;
  sectionId?: string;
  actionIcon?: string;
  isEditing: boolean;
  devices: SnapshotDevice[];
  roomsByHome: Record<string, SnapshotRoom[]>;
  snapshotPending: boolean;
  processingCardId: string | null;
  actionFeedback: { id: string; status: 'success' | 'error'; message?: string } | null;
  catalogLabel: (kind: SectionCardKind) => string;
  handleCardAction: (card: NormalizedSectionCardItem, event?: MouseEvent) => void | Promise<void>;
  handleMediaCardAction: (card: NormalizedSectionCardItem, command: MediaPlayerCommand, params?: Record<string, unknown>) => void | Promise<void>;
  executeSectionDeviceCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  upsertDevice: (device: SnapshotDevice) => void;
  openCardEditor: (card: NormalizedSectionCardItem) => void;
  registerRowSpanRef: (cardId: string, element: HTMLElement | null) => void;
  rowSpan: number;
  placedRow?: number;
}) {
  const { t } = useTranslation();
  const dragIdentities = useContext(SectionCardDragContext);
  const [touchSelected, setTouchSelected] = useState(false);
  const previewNode = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!touchSelected) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !previewNode.current?.contains(event.target)) setTouchSelected(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [touchSelected]);
  // getEffectiveCardSpan guards against a stale/manually-dragged 'small'
  // span on a kind that can't render as a quarter-width tile; media is
  // always full width, including when a legacy configuration stores less.
  const savedSpan = getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind));
  const gridOptions = card.gridOptions;
  const explicitHeight = getCardGridHeight(gridOptions?.rows);
  const span = gridOptions ? gridOptions.columns === 'full' || gridOptions.columns > 6 ? 'full' : gridOptions.columns <= 3 ? 'small' : 'medium' : savedSpan;
  const subtitle = card.entityName || card.description;
  const isCamera = normalizeKind(card.kind) === 'camera';
  const assignedDevice = card.entityId ? devices.find(device => device.id === card.entityId) : undefined;
  const plcPulse = isMomentaryPlcCommand(assignedDevice) && ['device', 'light', 'action'].includes(normalizeKind(card.kind));
  const normalizedKind = plcPulse ? 'action' : normalizeKind(card.kind);
  const skeletonVariant: DashboardCardSkeletonVariant | null = normalizedKind === 'sensor' ? 'sensor'
    : normalizedKind === 'camera' ? 'camera'
      : normalizedKind === 'media' ? 'media'
        : normalizedKind === 'device' || normalizedKind === 'cover' ? 'control'
          : normalizedKind === 'room' ? 'generic' : null;
  const isCover = normalizedKind === 'cover';
  const isTileKind = normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'action';
  const roomDevices = normalizedKind === 'room' && card.entityId
    ? devices.filter((device) => device.roomId === card.entityId)
    : [];
  // Buttons and clocks can render their configured content immediately. A
  // missing device after the first snapshot is unavailable, not still loading.
  const initialPending = Boolean(card.entityId && (skeletonVariant || normalizedKind === 'info_sensor') && needsInitialDashboardSkeleton(snapshotPending, Boolean(assignedDevice)));
  const showSkeleton = useDelayedSkeleton(initialPending);
  const assignedRoomName = assignedDevice?.roomId
    ? (roomsByHome[assignedDevice.homeId] ?? []).find((room) => room.id === assignedDevice.roomId)?.name
    : undefined;
  const cardIsActive = assignedDevice ? isDeviceActive(assignedDevice) : false;
  const actionIsActive = normalizedKind === 'action' && (processingCardId === card.id || (!plcPulse && actionFeedback?.id === card.id && actionFeedback.status === 'success'));
  const tileIsActive = normalizedKind === 'action' ? actionIsActive : cardIsActive;
  const isActionable = Boolean(card.entityId)
    && !isEditing
    && (normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'action');
  // Sensor copy determines its intrinsic masonry row height. Cover loading
  // reserves the real tile's structural rows without the preview's
  // illustrative controls or a magic pixel height.
  const reserveContentGeometry = normalizedKind === 'sensor';
  const overlaySkeleton = reserveContentGeometry || isCover;


  const cardContent = <SectionCardContent
    kind={plcPulse ? 'action' : card.kind}
    title={card.title || catalogLabel(card.kind)}
    subtitle={isCamera ? assignedRoomName : subtitle}
    span={span}
    icon={actionIcon ?? card.icon}
    mediaVariant={card.mediaVariant}
    sensorScale={card.sensorScale}
    sensorDecimals={card.sensorDecimals}
    visualStyle={card.visualStyle}
    isAssigned={Boolean(card.entityId)}
    isActive={tileIsActive}
    device={assignedDevice}
    isEditorPreview={isEditing}
    isMediaProcessing={processingCardId === card.id}
    onMediaCommand={normalizedKind === 'media'
      ? (command, params) => { void handleMediaCardAction(card, command, params); }
      : undefined}
    roomDeviceCount={roomDevices.length}
    roomActiveCount={roomDevices.filter(isDeviceActive).length}
    onDeviceUpdate={upsertDevice}
    onDeviceCommand={isCover ? executeSectionDeviceCommand : undefined}
    onAction={normalizedKind === 'action' && !isEditing ? () => { void handleCardAction(card); } : undefined}
    actionFeedback={processingCardId === card.id ? 'pending' : actionFeedback?.id === card.id ? actionFeedback.status : undefined}
    actionError={actionFeedback?.id === card.id && actionFeedback.message ? t(actionFeedback.message) : undefined}
  />;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: sectionId ? sectionCardDragId(sectionId, card.id, dragIdentities) : card.id,
    data: { kind: 'section-card', sectionId, cardId: card.id, preview: cardContent, getPreviewRect: () => previewNode.current?.getBoundingClientRect(), getPreviewNode: () => previewNode.current },
    disabled: !isEditing,
    transition: DASHBOARD_DRAG_TRANSITION,
  });
  const interactionAttributes = isEditing ? attributes
    : isActionable && normalizedKind !== 'action'
      ? { role: 'button' as const, tabIndex: 0, 'aria-label': card.title || catalogLabel(card.kind) } : {};

  return (
    <div
      key={card.id}
      data-dashboard-card-id={card.id}
      data-dashboard-drag-origin={isDragging ? 'true' : undefined}
      data-dashboard-drop-target={isEditing && isOver && !isDragging ? 'true' : undefined}
      ref={(element) => {
        previewNode.current = element;
        setNodeRef(element);
        registerRowSpanRef(card.id, element);
      }}
      style={{
        ...getCardPresentationStyle(gridOptions?.rows),
        ...(isClockKind(card.kind) ? { containerName: 'clock-card' } : {}),
        minHeight: explicitHeight,
        ...((normalizedKind === 'sensor' || isClockKind(card.kind)) && explicitHeight !== undefined ? { height: explicitHeight, minHeight: 0, ...(isClockKind(card.kind) ? { containerType: 'size' as const, containerName: 'clock-card' } : {}) } : {}),
        gridColumn: gridOptions?.columnStart ? `${gridOptions.columnStart} / span ${gridOptions.columns === 'full' ? 12 : gridOptions.columns}` : gridOptions ? gridOptions.columns === 'full' ? '1 / -1' : `span ${gridOptions.columns}` : undefined,
        // Tile-kind cards get a fixed uniform height so identical tiles
        // don't jitter a few pixels apart from a 1- vs 2-line title. But
        // it's a floor, never a hard cap: Math.max against the actually
        // measured height means content that genuinely needs more room
        // (long titles, font differences) still gets it instead of being
        // clipped by the card's own overflow-hidden background.
        // Keep the same measured rows in view and edit so changing modes
        // cannot compress the section's vertical rhythm.
        gridRow: `${placedRow ?? gridOptions?.rowStart ? `${placedRow ?? gridOptions?.rowStart} / ` : ''}span ${getCardGridRowSpan(gridOptions?.rows, rowSpan, isTileKind ? COMPACT_TILE_ROW_SPAN : 1)}`,
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
      }}
      onPointerUp={(event) => { if (isEditing && event.pointerType === 'touch' && !isDragging) setTouchSelected(true); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTouchSelected(false); }}
      onClick={initialPending || isCover || normalizedKind === 'action' ? undefined : (event) => { void handleCardAction(card, event); }}
      onKeyDown={isActionable && normalizedKind !== 'action' && !initialPending ? (event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        void handleCardAction(card);
      } : undefined}
      {...interactionAttributes}
      {...(isEditing ? listeners : {})}
      className={cn(
        // `grid` here isn't for a multi-cell layout — CardPreview is the
        // only child. It's so that child fills this box automatically:
        // this element's own height comes from min-height + grid-row
        // placement (never an explicit height), and a CSS percentage
        // height on the child (h-full) doesn't resolve against a parent
        // whose own height is indefinite that way — a grid container's
        // default stretch sizing does, regardless of *why* its own size
        // was determined. Without this, the card's colored background
        // (painted by CardPreview) could end up shorter than this outer
        // box, leaving a transparent gap at the bottom.
        "homepilot-sized-card group/card relative grid min-w-0 overflow-hidden shadow-sm",
        normalizedKind === 'sensor' && explicitHeight !== undefined && 'homepilot-bounded-sensor',
        isEditing && "touch-pan-y",
        getCardFrameClass(normalizedKind, span, tileIsActive),
        isActionable && !initialPending && "cursor-pointer hover:-translate-y-0.5 hover:shadow-depth-2 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isDragging && "z-30 opacity-40",
        getSpanClass(span)
      )}
    >
      {initialPending ? (
        <div className="relative grid h-full min-h-0 w-full" aria-busy="true">
          {reserveContentGeometry && <div className="invisible min-h-0" aria-hidden="true">{cardContent}</div>}
          {isCover && <div className="invisible min-h-0" aria-hidden="true"><CurtainDeviceTileLoadingGeometry /></div>}
          {skeletonVariant && <DashboardCardSkeleton variant={skeletonVariant} visible={showSkeleton} className={overlaySkeleton ? 'absolute inset-0' : undefined} />}
          {normalizedKind === 'info_sensor' && showSkeleton && <InformationCardSkeleton />}
        </div>
      ) : cardContent}

      {isEditing ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-background/50 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
        />
      ) : null}

      {processingCardId === card.id && normalizedKind !== 'action' ? (
        <div className="pointer-events-none absolute right-3 top-3 z-30 grid h-7 w-7 place-items-center rounded-full border border-primary/20 bg-background/80 text-primary shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : null}

      {isEditing ? (
        <>
          {(
            <div className={cn("pointer-events-none absolute inset-0 z-20 grid place-items-center opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100", touchSelected && "opacity-100")}>
              <IconButton
                icon={Pencil}
                label={t('common.edit')}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  openCardEditor(card);
                }}
                variant="default"
                size="lg"
                className="pointer-events-auto rounded-full bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
              />
            </div>
          )}
        </>
      ) : null}

    </div>
  );
}
