import { useEffect, useState, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { type SnapshotDevice, type SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import { isDeviceActive } from '../dashboardUtils';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { CurtainDeviceTileLoadingGeometry } from '../../../components/CurtainDeviceTile';
import type { MediaPlayerCommand } from './MediaPlayerCard';
import { CardResizeHandle } from './CardResizeHandle';
import { MASONRY_ROW_GAP_PX, MASONRY_ROW_UNIT_PX } from './useMasonryRowSpans';
import { ModalPortal } from './ModalPortal';
import { SectionCardContent } from './SectionCardContent';
import { DashboardCardSkeleton, type DashboardCardSkeletonVariant } from '../../../components/ui/DashboardCardSkeleton';
import { needsInitialDashboardSkeleton, useDelayedSkeleton } from '../../../components/ui/useDashboardDelayedSkeleton';
import {
  canUseCompactSpan, getDefaultSpan, getEffectiveCardSpan, getSpanClass,
  isClockKind, normalizeKind, type NormalizedSectionCardItem,
  type SectionCardKind, type SectionCardSpan,
} from './sectionCardCatalog';

// Compact tiles share a minimum masonry row span despite title wrapping.
const COMPACT_TILE_ROW_SPAN = Math.ceil((96 + MASONRY_ROW_GAP_PX) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX));
const COMPACT_CARD_SPAN_ORDER: SectionCardSpan[] = ['small', 'medium', 'full'];
const STANDARD_CARD_SPAN_ORDER: SectionCardSpan[] = ['medium', 'full'];

export function SectionCardItem({
  card,
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
  removeCard,
  resizeCard,
  registerRowSpanRef,
  rowSpan,
}: {
  card: NormalizedSectionCardItem;
  isEditing: boolean;
  devices: SnapshotDevice[];
  roomsByHome: Record<string, SnapshotRoom[]>;
  snapshotPending: boolean;
  processingCardId: string | null;
  actionFeedback: { id: string; status: 'success' | 'error' } | null;
  catalogLabel: (kind: SectionCardKind) => string;
  handleCardAction: (card: NormalizedSectionCardItem, event?: MouseEvent) => void | Promise<void>;
  handleMediaCardAction: (card: NormalizedSectionCardItem, command: MediaPlayerCommand, params?: Record<string, unknown>) => void | Promise<void>;
  executeSectionDeviceCommand: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<SnapshotDevice | null>;
  upsertDevice: (device: SnapshotDevice) => void;
  openCardEditor: (card: NormalizedSectionCardItem) => void;
  removeCard: (id: string) => void;
  resizeCard: (cardId: string, nextSpan: SectionCardSpan) => void;
  registerRowSpanRef: (cardId: string, element: HTMLElement | null) => void;
  rowSpan: number;
}) {
  const { t } = useTranslation();
  const [isCardMenuOpen, setIsCardMenuOpen] = useState(false);
  const [cardMenuPosition, setCardMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !isEditing,
  });

  // getEffectiveCardSpan guards against a stale/manually-dragged 'small'
  // span on a kind that can't render as a quarter-width tile; media is
  // always full width, including when a legacy configuration stores less.
  const span = getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind));
  const subtitle = card.entityName || card.description;
  const isCamera = normalizeKind(card.kind) === 'camera';
  const isClock = isClockKind(card.kind);
  const normalizedKind = normalizeKind(card.kind);
  const skeletonVariant: DashboardCardSkeletonVariant | null = normalizedKind === 'sensor' ? 'sensor'
    : normalizedKind === 'camera' ? 'camera'
      : normalizedKind === 'media' ? 'media'
        : normalizedKind === 'device' || normalizedKind === 'cover' ? 'control'
          : normalizedKind === 'room' ? 'generic' : null;
  const isCover = normalizedKind === 'cover';
  const isTileKind = normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'action';
  const isCompactDeviceCard = isTileKind && span === 'small';
  const canResize = isEditing && !isClock && normalizedKind !== 'media';
  const spanOrder = canUseCompactSpan(card.kind) ? COMPACT_CARD_SPAN_ORDER : STANDARD_CARD_SPAN_ORDER;
  const roomDevices = normalizedKind === 'room' && card.entityId
    ? devices.filter((device) => device.roomId === card.entityId)
    : [];
  const assignedDevice = card.entityId
    ? devices.find((device) => device.id === card.entityId)
    : undefined;
  // Buttons and clocks can render their configured content immediately. A
  // missing device after the first snapshot is unavailable, not still loading.
  const initialPending = Boolean(card.entityId && skeletonVariant && needsInitialDashboardSkeleton(snapshotPending, Boolean(assignedDevice)));
  const showSkeleton = useDelayedSkeleton(initialPending);
  const assignedRoomName = assignedDevice?.roomId
    ? (roomsByHome[assignedDevice.homeId] ?? []).find((room) => room.id === assignedDevice.roomId)?.name
    : undefined;
  const cardIsActive = assignedDevice ? isDeviceActive(assignedDevice) : false;
  const actionIsActive = normalizedKind === 'action' && (processingCardId === card.id || (actionFeedback?.id === card.id && actionFeedback.status === 'success'));
  const tileIsActive = normalizedKind === 'action' ? actionIsActive : cardIsActive;
  const isActionable = Boolean(card.entityId)
    && !isEditing
    && (normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'action');
  // Sensor copy determines its intrinsic masonry row height. Cover loading
  // reserves the real tile's structural rows without the preview's
  // illustrative controls or a magic pixel height.
  const reserveContentGeometry = normalizedKind === 'sensor';
  const overlaySkeleton = reserveContentGeometry || isCover;

  useEffect(() => {
    if (!isCardMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCardMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isCardMenuOpen]);

  const cardContent = <SectionCardContent
    kind={card.kind}
    title={card.title || catalogLabel(card.kind)}
    subtitle={isCamera ? assignedRoomName : subtitle}
    span={span}
    icon={card.icon}
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
  />;

  return (
    <div
      key={card.id}
      data-dashboard-card-id={card.id}
      ref={(element) => {
        setNodeRef(element);
        registerRowSpanRef(card.id, element);
      }}
      style={{
        containerType: 'inline-size',
        // Tile-kind cards get a fixed uniform height so identical tiles
        // don't jitter a few pixels apart from a 1- vs 2-line title. But
        // it's a floor, never a hard cap: Math.max against the actually
        // measured height means content that genuinely needs more room
        // (long titles, font differences) still gets it instead of being
        // clipped by the card's own overflow-hidden background.
        // Keep the same measured rows in view and edit so changing modes
        // cannot compress the section's vertical rhythm.
        gridRow: `span ${isTileKind ? Math.max(rowSpan, COMPACT_TILE_ROW_SPAN) : rowSpan}`,
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
      }}
      onClick={initialPending || isCover || normalizedKind === 'action' ? undefined : (event) => { void handleCardAction(card, event); }}
      {...(isEditing ? attributes : {})}
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
        "group/card relative grid min-w-0 overflow-hidden rounded-section shadow-sm transition-all",
        isTileKind
          ? "min-h-device-card-compact"
          : span === 'small' && "min-h-section-card-sm",
        !isTileKind && span === 'medium' && "min-h-section-card-md",
        !isTileKind && span === 'full' && "min-h-section-card-lg",
        isCamera && "min-h-curtain-card",
        isClock && "min-h-clock-card",
        // Match the live CurtainDeviceTile's dashboard min-height at sm+.
        isCover && "w-full max-w-curtain-dashboard justify-self-start sm:min-h-curtain-card",
        isActionable && !initialPending && "cursor-pointer hover:-translate-y-0.5 hover:shadow-depth-2",
        (normalizedKind === 'light' || normalizedKind === 'action') && tileIsActive && "homepilot-section-light-tile-active",
        isDragging && "z-30 opacity-45",
        getSpanClass(span)
      )}
    >
      {initialPending ? (
        <div className="relative grid h-full min-h-0 w-full" aria-busy="true">
          {reserveContentGeometry && <div className="invisible min-h-0" aria-hidden="true">{cardContent}</div>}
          {isCover && <div className="invisible min-h-0" aria-hidden="true"><CurtainDeviceTileLoadingGeometry /></div>}
          {skeletonVariant && <DashboardCardSkeleton variant={skeletonVariant} visible={showSkeleton} className={overlaySkeleton ? 'absolute inset-0' : undefined} />}
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
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
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
              size={isCompactDeviceCard ? "sm" : "md"}
              className="pointer-events-auto rounded-full bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
            />
          </div>
          <div className={cn("pointer-events-none absolute right-2 top-2 z-30 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100", isCompactDeviceCard && "right-1 top-1")}>
            <IconButton
              icon={MoreVertical}
              label={t('dashboard.editor.sections.card_actions')}
              aria-haspopup="menu"
              aria-expanded={isCardMenuOpen}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                setCardMenuPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
                setIsCardMenuOpen((isOpen) => !isOpen);
              }}
              variant="default"
              size={isCompactDeviceCard ? "sm" : "md"}
              className="rounded-full bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
            />
          </div>
        </>
      ) : null}

      {isEditing && isCardMenuOpen && cardMenuPosition ? (
        <ModalPortal>
          <div className="fixed inset-0 z-40" aria-hidden="true" onPointerDown={() => setIsCardMenuOpen(false)} />
          <div
            role="menu"
            aria-label={t('dashboard.editor.sections.card_actions')}
            style={cardMenuPosition}
            onPointerDown={(event) => event.stopPropagation()}
            className="fixed z-50 min-w-36 rounded-panel border border-border/70 bg-card p-1.5 shadow-depth-3"
          >
            <Button
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCardMenuOpen(false);
                openCardEditor(card);
              }}
              className="w-full justify-start font-semibold"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
            <div role="separator" className="my-1 border-t border-border/65" />
            <Button
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCardMenuOpen(false);
                removeCard(card.id);
              }}
              className="w-full justify-start font-semibold text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('common.delete')}
            </Button>
          </div>
        </ModalPortal>
      ) : null}

      {canResize ? (
        <CardResizeHandle
          span={span}
          spanOrder={spanOrder}
          label={t('dashboard.editor.sections.resize_card')}
          onResize={(nextSpan) => resizeCard(card.id, nextSpan)}
        />
      ) : null}
    </div>
  );
}
