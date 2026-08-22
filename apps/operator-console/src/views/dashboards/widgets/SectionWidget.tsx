import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Camera,
  Check,
  CircleAlert,
  GripVertical,
  Home,
  Loader2,
  Maximize2,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  VideoOff,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { StatusPill } from '../../../components/ui/StatusPill';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { CameraMediaFrame, type CameraFeedMode } from '../../../components/CameraMediaFrame';
import { CameraViewerModal } from '../../../components/CameraViewerModal';
import { useDeviceSnapshotStore, type SnapshotDevice, type SnapshotRoom } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig } from '../types';
import { canUseCompactSpan, cardKinds, catalogCategories, clockCardOptions, createId, getCatalogCategory, getCatalogDescriptionKey, getCatalogLabelKey, getClockKindLabelKey, getClockStyleForKind, getDefaultIcon, getDefaultSpan, getEffectiveCardSpan, getRecommendedSectionHeight, getSpanClass, getWidgetType, isBindableKind, isClockKind, MAX_MANUAL_ROW_SPAN, normalizeCards, normalizeKind, type AssignableAutomation, type AssignableScene, type CardDraft, type NormalizedSectionCardItem, type NormalizedSectionCardKind, type SectionCardCategory, type SectionCardIcon, type SectionCardKind, type SectionCardSpan } from './sectionCardCatalog';
import { getAssignableDevicesForSectionCard, isDeviceActive } from '../dashboardUtils';
import { canExecuteCommand } from '../../../lib/deviceCapabilities';
import { IconPicker, getDashboardIconComponent, needsMdiCatalog, useMdiCatalogLoaded } from '../components/IconPicker';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { Button } from '../../../components/ui/Button';
import { IconButton } from '../../../components/ui/IconButton';
import { Input } from '../../../components/ui/Input';
import { ClockWidget } from './ClockWidget';
import { SensorMetricCard } from './SensorMetricCard';
import { MediaPlayerCard, type MediaPlayerCommand } from './MediaPlayerCard';
import { CurtainDeviceTile, CurtainDeviceTilePreview } from '../../../components/CurtainDeviceTile';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

function iconForIconKey(icon: SectionCardIcon) {
  return getDashboardIconComponent(icon);
}

function SectionClockPreview({ kind, title }: { kind: SectionCardKind; title: string }) {
  const clockStyle = getClockStyleForKind(kind);
  const clockConfig: DashboardWidgetConfig = {
    layout: { x: 0, y: 0, w: 4, h: 4 },
    binding: { entityId: '', entityType: 'system', entityName: title },
    visibility: { rules: [], defaultState: 'show' },
    appearance: { variant: 'glass', title, showTitle: true },
    extra: { clockStyle },
  };

  return (
    <div className="h-full min-h-clock-card overflow-hidden rounded-section">
      <ClockWidget config={clockConfig} />
    </div>
  );
}


function getAssignableRooms(roomsByHome: Record<string, SnapshotRoom[]>) {
  return Object.values(roomsByHome)
    .flat()
    .filter((room) => room.id && room.name)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

function normalizeAssignableScene(rawScene: unknown): AssignableScene | null {
  if (!rawScene || typeof rawScene !== 'object') return null;
  const scene = rawScene as Record<string, unknown>;
  if (typeof scene.id !== 'string') return null;
  const name = typeof scene.name === 'string' && scene.name.trim() ? scene.name : 'Escena';
  return { id: scene.id, name };
}

// A single "Scene" card can be bound to either a HomePilot scene or an
// automation ("routine") — both are one-tap, stateless targets. Automation
// ids carry this prefix in persisted card.entityId so execution knows which
// endpoint to call; plain ids stay scenes, preserving every card saved
// before routines could be assigned here.
const AUTOMATION_ENTITY_PREFIX = 'automation:';

function isAutomationEntityId(entityId?: string): boolean {
  return typeof entityId === 'string' && entityId.startsWith(AUTOMATION_ENTITY_PREFIX);
}

function stripAutomationEntityPrefix(entityId: string): string {
  return entityId.slice(AUTOMATION_ENTITY_PREFIX.length);
}

function normalizeAssignableAutomation(rawAutomation: unknown): AssignableAutomation | null {
  if (!rawAutomation || typeof rawAutomation !== 'object') return null;
  const automation = rawAutomation as Record<string, unknown>;
  if (typeof automation.id !== 'string') return null;
  const name = typeof automation.name === 'string' && automation.name.trim() ? automation.name : 'Rutina';
  return {
    id: automation.id,
    name,
    enabled: automation.enabled !== false,
  };
}




interface CameraMediaSession {
  snapshotPath: string;
  streamPath: string;
  hlsPath?: string;
}

function isCameraMediaSession(v: unknown): v is CameraMediaSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s.snapshotPath === 'string' && typeof s.streamPath === 'string';
}

function absoluteSessionUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function SectionCameraCard({ deviceId, title }: { deviceId: string; title: string }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<CameraMediaSession | null>(null);
  const sessionRef = useRef<CameraMediaSession | null>(null);
  const [hasFeedError, setHasFeedError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>('stream');
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerSession, setViewerSession] = useState<CameraMediaSession | null>(null);
  const viewerSessionControllerRef = useRef<AbortController | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsConnecting(true);
    setHasFeedError(false);

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/camera/session`, {
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`SESSION_${res.status}`);
      const payload: unknown = await res.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_SESSION');
      sessionRef.current = payload;
      setSession(payload);
      setFeedMode(payload.hlsPath ? 'hls' : 'stream');
      setIsConnecting(false);
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setHasFeedError(true);
      setIsConnecting(false);
    });

    return () => controller.abort();
  }, [deviceId, retryVersion]);

  // Refresh the media session well before its access token expires so a
  // camera card left open on a kiosk/dashboard never goes dark on its own.
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setRetryVersion((version) => version + 1), 25 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => () => viewerSessionControllerRef.current?.abort(), []);

  const retry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setFeedMode(sessionRef.current?.hlsPath ? 'hls' : 'stream');
    setIsConnecting(true);
    setHasFeedError(false);
    setRetryVersion((version) => version + 1);
  };

  if (isConnecting && !session) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 bg-black/40">
        <div className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5">
          <Camera className="h-5 w-5 animate-pulse text-white/70" />
        </div>
        <span className="text-caption font-medium text-white/60">{t('camera.connecting')}</span>
      </div>
    );
  }

  if (hasFeedError || !session) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-2.5 bg-scene-preview">
        <div className="grid h-11 w-11 place-items-center rounded-full border border-danger/25 bg-danger/10 text-danger">
          <VideoOff className="h-5 w-5" />
        </div>
        <span className="text-caption font-medium text-white/60">{t('camera.connection_error')}</span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={retry}
          aria-label={t('camera.retry')}
          className="absolute bottom-3 right-3 shrink-0 rounded-pill"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const streamUrl = absoluteSessionUrl(session.streamPath);
  const snapshotUrl = absoluteSessionUrl(session.snapshotPath);
  const hlsUrl = session.hlsPath ? absoluteSessionUrl(session.hlsPath) : undefined;
  const openViewer = () => {
    viewerSessionControllerRef.current?.abort();
    const controller = new AbortController();
    viewerSessionControllerRef.current = controller;
    setViewerSession(session);
    setIsViewerOpen(true);

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/camera/session`, {
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`VIEWER_SESSION_${res.status}`);
      const payload: unknown = await res.json();
      if (!isCameraMediaSession(payload)) throw new Error('INVALID_VIEWER_SESSION');
      if (!controller.signal.aborted) setViewerSession(payload);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('[SectionCameraCard] Enhanced camera viewer session unavailable, keeping direct stream.', error);
      }
    });
  };
  const closeViewer = () => {
    viewerSessionControllerRef.current?.abort();
    viewerSessionControllerRef.current = null;
    setIsViewerOpen(false);
    setViewerSession(null);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="md"
        className="group relative h-full w-full overflow-hidden text-left"
        onClick={(event) => {
          event.stopPropagation();
          if (!hasFeedError) openViewer();
        }}
        aria-label={t('camera.open_viewer', { name: title })}
      >
        <CameraMediaFrame
          active={!isViewerOpen}
          hlsUrl={hlsUrl}
          streamUrl={streamUrl}
          snapshotUrl={snapshotUrl}
          preferredMode={feedMode}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onModeChange={setFeedMode}
          onReady={() => { /* noop */ }}
          onFailure={() => setHasFeedError(true)}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill border border-white/15 bg-black/60 px-2.5 py-1 text-micro font-semibold uppercase tracking-wide text-white backdrop-blur-md">
          <StatusPill variant="danger" dot pulse dotLabel={t('camera.live')} />
          {t('camera.live')}
        </div>
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
          <Maximize2 className="h-4 w-4" />
        </span>
      </Button>

      {viewerSession && (
        <CameraViewerModal
          isOpen={isViewerOpen}
          name={title}
          streamUrl={absoluteSessionUrl(viewerSession.streamPath)}
          hlsUrl={viewerSession.hlsPath ? absoluteSessionUrl(viewerSession.hlsPath) : undefined}
          snapshotUrl={absoluteSessionUrl(viewerSession.snapshotPath)}
          preferredMode={viewerSession.hlsPath ? 'hls' : 'stream'}
          onClose={closeViewer}
        />
      )}
    </>
  );
}

// Legacy helper kept for editor preview only (not used in live render)
function _CameraMediaPlaceholder() {
  return (
    <div className="grid h-full w-full place-items-center bg-scene-preview">
      <div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/25 text-white/70">
        <Camera className="h-9 w-9" />
      </div>
    </div>
  );
}

function CardPreview({
  kind,
  title,
  subtitle,
  span,
  icon,
  isAssigned,
  isActive,
  deviceId,
  device,
  isPreview,
  isMediaProcessing,
  onMediaCommand,
  roomDeviceCount,
  roomActiveCount,
  onDeviceUpdate,
  onDeviceCommand,
  onAction,
  actionFeedback,
}: {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  span: SectionCardSpan;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  isActive?: boolean;
  deviceId?: string;
  device?: SnapshotDevice;
  isPreview?: boolean;
  isMediaProcessing?: boolean;
  onMediaCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
  roomDeviceCount?: number;
  roomActiveCount?: number;
  onDeviceUpdate?: (device: SnapshotDevice) => void;
  onDeviceCommand?: (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ) => Promise<SnapshotDevice | null>;
  onAction?: () => void;
  actionFeedback?: 'pending' | 'success' | 'error';
}) {
  const { t } = useTranslation();
  // Default card icons resolve from the bundled baseline. Custom MDI entries
  // still load on demand and preserve existing dashboard configurations.
  useMdiCatalogLoaded(needsMdiCatalog(icon ?? getDefaultIcon(kind)));
  const normalized = normalizeKind(kind);
  const Icon = iconForIconKey(icon ?? getDefaultIcon(normalized));
  const isSmall = span === 'small';

  if (isClockKind(normalized)) {
    return (
      <SectionClockPreview kind={normalized} title={title} />
    );
  }

  if (normalized === 'camera') {
    return (
      <div className="relative h-full min-h-curtain-card overflow-hidden rounded-section border border-border/40 bg-card shadow-sm">
        {deviceId ? (
          <SectionCameraCard deviceId={deviceId} title={title} />
        ) : (
          <_CameraMediaPlaceholder />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        <div className="absolute bottom-3 left-3 right-3">
          <p className="line-clamp-2 text-body font-black leading-tight text-white drop-shadow">
            {title}
          </p>
          <p className="mt-0.5 truncate text-caption font-semibold text-white/75">
            {deviceId ? subtitle || t('common.unassigned') : subtitle || t('dashboard.editor.sections.camera_unassigned')}
          </p>
        </div>
      </div>
    );
  }

  if (normalized === 'sensor') {
    return <SensorMetricCard device={device} title={title} isPreview={isPreview} />;
  }

  if (normalized === 'media') {
    return (
      <MediaPlayerCard
        device={device}
        title={title}
        isPreview={isPreview}
        isProcessing={isMediaProcessing}
        onCommand={onMediaCommand}
        compact={isSmall}
      />
    );
  }

  if (normalized === 'cover') {
    const density = isSmall ? 'compact' : 'standard';

    if (device && !isPreview) {
      return (
        <CurtainDeviceTile
          device={device}
          roomName={subtitle}
          onUpdate={onDeviceUpdate}
          onCommand={onDeviceCommand}
          layout="dashboard"
          density={density}
        />
      );
    }

    return (
      <CurtainDeviceTilePreview
        title={title}
        roomName={subtitle}
        layout="dashboard"
        density={density}
      />
    );
  }

  if (normalized === 'action') {
    const actionLabel = actionFeedback === 'pending'
      ? t('dashboard.editor.sections.action_button_pending')
      : actionFeedback === 'success'
        ? t('dashboard.editor.sections.action_button_success')
        : actionFeedback === 'error'
          ? t('dashboard.editor.sections.action_button_error')
          : t('dashboard.editor.sections.action_button_execute');
    const unavailable = !isAssigned || !onAction || Boolean(isPreview);

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAction?.();
        }}
        disabled={unavailable || actionFeedback === 'pending'}
        aria-busy={actionFeedback === 'pending' || undefined}
        aria-label={t('dashboard.editor.sections.action_button_aria', { name: title })}
        title={unavailable ? t('dashboard.editor.sections.action_button_unavailable') : undefined}
        className={cn(
          'dashboard-action-button relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden rounded-section border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-65 sm:p-4',
          `dashboard-action-button--${actionFeedback}`,
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <span className="dashboard-action-button__icon grid h-10 w-10 shrink-0 place-items-center rounded-control border">
            {actionFeedback === 'pending'
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : actionFeedback === 'success'
                ? <Check className="h-5 w-5" />
                : actionFeedback === 'error'
                  ? <CircleAlert className="h-5 w-5" />
                  : <Icon className="h-5 w-5" />}
          </span>
          <span className="dashboard-action-button__status min-w-0 max-w-[calc(100%-3.25rem)] truncate rounded-pill border px-2.5 py-1 text-micro font-semibold normal-case tracking-normal">
            {actionLabel}
          </span>
        </div>
        <div className="min-w-0 pt-3">
          <span className="block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-caption font-medium text-muted-foreground">
            {subtitle || t('dashboard.editor.sections.action_button_description')}
          </span>
        </div>
      </button>
    );
  }
  if (normalized === 'energy') {
    return (
      <div className="flex h-full min-h-0 flex-col justify-between rounded-section border border-border/45 bg-card p-4">
        <span className="text-micro font-black uppercase tracking-label-wide text-primary">{t('dashboard.editor.sections.energy_label')}</span>
        <div>
          <span className="text-hero-title font-black text-foreground">1.8</span>
          <span className="ml-1 text-body font-black text-muted-foreground">kW</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full w-percent-64 rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (normalized === 'room') {
    return (
      <div className="relative flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-section border border-border/60 bg-room-card p-3.5 text-foreground shadow-surface-card ring-1 ring-background/70 transition-all dark:border-primary/20 dark:bg-room-card-dark dark:shadow-primary-room sm:p-4">
        <div className="pointer-events-none absolute inset-0 bg-room-card-aura opacity-80 dark:opacity-100" />
        <div className="flex items-start justify-between gap-3">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10 sm:h-11 sm:w-11">
            <Home className="h-room-icon w-room-icon sm:h-5 sm:w-5" />
          </span>
          <span className="relative rounded-full border border-border/65 bg-background/90 px-2.5 py-1 text-micro font-black uppercase tracking-control text-muted-foreground shadow-sm dark:bg-background/45 sm:text-micro">
            {t('dashboard.editor.sections.room_label')}
          </span>
        </div>

        <div className="relative min-w-0 py-2">
          <span className="block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-micro font-black uppercase tracking-status text-muted-foreground sm:text-micro">
            {t('dashboard.editor.sections.room_access')}
          </span>
        </div>

        <div className="relative grid grid-cols-2 gap-2">
          <span className="min-w-0 rounded-2xl border border-border/65 bg-background/95 px-3 py-2 shadow-sm dark:bg-background/45">
            <span className="block truncate text-micro font-black uppercase tracking-control text-muted-foreground">
              {t('dashboard.editor.sections.room_devices')}
            </span>
            <span className="mt-0.5 block truncate text-body-lg font-black text-foreground sm:text-section-title">
              {roomDeviceCount ?? 0}
            </span>
          </span>
          <span className="min-w-0 rounded-2xl border border-primary/35 bg-primary/10 px-3 py-2 shadow-primary-room-icon ring-1 ring-primary/10">
            <span className="block truncate text-micro font-black uppercase tracking-control text-primary">
              {t('dashboard.editor.sections.room_active')}
            </span>
            <span className="mt-0.5 block truncate text-body-lg font-black text-primary sm:text-section-title">
              {roomActiveCount ?? 0}
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (normalized === 'scene') {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-primary/25 bg-room-card-rich p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-inner">
            <Monitor className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-micro font-black uppercase tracking-status text-primary">
            {t('dashboard.editor.sections.scene_list')}
          </span>
        </div>
        <div className="mt-auto min-w-0">
          <span className="block text-micro font-black uppercase tracking-label-wide text-primary/80">{t('dashboard.editor.sections.scene_label')}</span>
          <span className="mt-1 block line-clamp-2 text-card-title font-black leading-tight text-foreground">{title}</span>
          <span className="mt-2 block line-clamp-2 text-micro font-semibold leading-snug text-muted-foreground">
            {subtitle || t('dashboard.editor.sections.scene_description')}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/45 bg-background/35 px-3 py-2">
          <span className="text-micro font-black uppercase tracking-status text-muted-foreground">{t('dashboard.editor.sections.scene_control')}</span>
          <span className="text-micro font-black uppercase tracking-status text-primary">{t('dashboard.editor.sections.scene_one_tap')}</span>
        </div>
      </div>
    );
  }

  if (normalized === 'assistant') {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-border/45 bg-room-card-quiet p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-border/45 bg-background/45 px-2 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">
            {t('dashboard.editor.sections.assistant_badge')}
          </span>
        </div>
        <div className="mt-auto min-w-0">
          <span className="block line-clamp-2 text-body font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-micro font-black uppercase tracking-label text-muted-foreground">
            {t('dashboard.editor.sections.smart_summary')}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-micro font-black uppercase tracking-control text-muted-foreground">
            <span>{t('dashboard.editor.sections.signals')}</span>
            <span className="text-primary">{t('dashboard.editor.sections.ready')}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/70">
            <div className="h-full w-percent-88 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  const isLightKind = normalized === 'light';
  const isTileKind = normalized === 'light' || normalized === 'device';

  // Compact, Home Assistant-style tile: a bare icon (no chip/circle behind
  // it) with the name wrapping below (up to two lines instead of being
  // truncated). No separate on/off text — the icon and title color already
  // carry the active state, exactly like Home Assistant's button cards.
  // This is the only rendering for light/device cards regardless of span —
  // 'small'/'medium'/'full' only change how many columns it occupies.
  if (isTileKind) {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border p-2.5 text-center text-foreground transition-all",
          isActive
            ? isLightKind
              ? "border-light-active/45 bg-light-active/14 shadow-surface-card"
              : "border-primary/45 bg-primary/14 shadow-surface-card"
            : "border-border/60 bg-card/95 shadow-surface-card"
        )}
      >
        <Icon className={cn(
          "h-7 w-7 shrink-0 transition-colors",
          isActive ? (isLightKind ? "text-light-active" : "text-primary") : "text-muted-foreground"
        )} />
        <span className="line-clamp-2 min-w-0 text-micro font-bold leading-tight text-foreground">{title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col items-center justify-center overflow-hidden rounded-section border p-3 text-center text-foreground transition-all sm:p-4",
        isActive
          ? "border-primary/80 bg-primary/20 shadow-primary-warm ring-2 ring-primary/30 dark:bg-device-active-dark"
          : "border-border/60 bg-card/95 shadow-surface-card ring-1 ring-background/45"
      )}
    >
      <span
        className={cn(
          "mb-2 grid place-items-center rounded-full transition-all sm:mb-3 h-24 w-24",
          isActive
            ? "bg-primary text-primary-foreground shadow-primary-room-icon ring-1 ring-primary/35"
            : "bg-muted/65 text-muted-foreground ring-1 ring-border/40"
        )}
      >
        <Icon className="h-20 w-20" />
      </span>
      <span className="line-clamp-2 min-w-0 text-body font-black leading-tight text-foreground">{title}</span>
      {!isAssigned ? (
        <span className="mt-1 line-clamp-2 text-micro font-bold leading-tight text-muted-foreground">
          {subtitle || t('dashboard.editor.sections.unassigned')}
        </span>
      ) : null}
    </div>
  );
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

// Home Assistant-style dense masonry: instead of one shared row height for
// every card (which stretches short cards up to their tallest row-mate),
// each card measures its own rendered height and claims only the grid rows
// it actually needs. `grid-auto-flow: dense` then lets shorter cards from
// later in the list backfill the gaps a tall card leaves in other columns.
const MASONRY_ROW_UNIT_PX = 20;
const MASONRY_ROW_GAP_PX = 12;

// Compact device/light tiles use a fixed row-span instead of their own
// measured height. A 1-line vs. 2-line title otherwise produces slightly
// different measured heights, so visually identical tiles end up a few
// pixels apart in height — the "collapsed/uneven tile" look. All compact
// tiles in a section now stay perfectly uniform.
const COMPACT_TILE_ROW_SPAN = Math.ceil((96 + MASONRY_ROW_GAP_PX) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX));

function useMasonryRowSpans() {
  const [rowSpans, setRowSpans] = useState<Record<string, number>>({});
  const observerRef = useRef<ResizeObserver | null>(null);

  // Created eagerly (not inside an effect) so it already exists when the
  // cards' ref callbacks fire during the same commit — effects run after
  // ref callbacks, which would otherwise miss every card mounted up front.
  if (observerRef.current === null && typeof ResizeObserver !== 'undefined') {
    observerRef.current = new ResizeObserver((entries) => {
      setRowSpans((previous) => {
        let changed = false;
        const next = { ...previous };

        for (const entry of entries) {
          const cardId = (entry.target as HTMLElement).dataset.cardId;
          if (!cardId) continue;

          const height = entry.contentRect.height;
          const span = Math.max(1, Math.ceil((height + MASONRY_ROW_GAP_PX) / (MASONRY_ROW_UNIT_PX + MASONRY_ROW_GAP_PX)));
          if (next[cardId] !== span) {
            next[cardId] = span;
            changed = true;
          }
        }

        return changed ? next : previous;
      });
    });
  }

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const registerCard = useCallback((cardId: string, element: HTMLElement | null) => {
    const observer = observerRef.current;
    if (!observer || !element) return;

    element.dataset.cardId = cardId;
    observer.observe(element);
  }, []);

  return { rowSpans, registerCard };
}

// Dragging the corner handle steps through the same small/medium/full sizes
// already offered in the card editor — a faster path to the same values,
// not a new free-form sizing model.
const CARD_SPAN_ORDER: SectionCardSpan[] = ['small', 'medium', 'full'];
const CARD_RESIZE_STEP_PX = 64;

function CardResizeHandle({
  span,
  label,
  onResize,
}: {
  span: SectionCardSpan;
  label: string;
  onResize: (nextSpan: SectionCardSpan) => void;
}) {
  const dragStartRef = useRef<{ x: number; index: number } | null>(null);

  return (
    <span
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={CARD_SPAN_ORDER.length - 1}
      aria-valuenow={CARD_SPAN_ORDER.indexOf(span)}
      aria-valuetext={span}
      tabIndex={0}
      title={label}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const currentIndex = CARD_SPAN_ORDER.indexOf(span);
        if (event.key === 'ArrowRight' && currentIndex < CARD_SPAN_ORDER.length - 1) {
          event.preventDefault();
          onResize(CARD_SPAN_ORDER[currentIndex + 1]);
        } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
          event.preventDefault();
          onResize(CARD_SPAN_ORDER[currentIndex - 1]);
        }
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartRef.current = { x: event.clientX, index: CARD_SPAN_ORDER.indexOf(span) };
      }}
      onPointerMove={(event) => {
        const start = dragStartRef.current;
        if (!start) return;
        const deltaSteps = Math.round((event.clientX - start.x) / CARD_RESIZE_STEP_PX);
        const nextIndex = Math.min(CARD_SPAN_ORDER.length - 1, Math.max(0, start.index + deltaSteps));
        const nextSpan = CARD_SPAN_ORDER[nextIndex];
        if (nextSpan !== span) onResize(nextSpan);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragStartRef.current = null;
      }}
      className="absolute bottom-1 right-1 z-20 grid h-6 w-6 cursor-nwse-resize touch-none place-items-center rounded-md bg-background/95 text-muted-foreground opacity-0 shadow-md backdrop-blur-md transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 [@media(hover:none)]:opacity-100"
    >
      <Maximize2 className="h-3 w-3 rotate-90" />
    </span>
  );
}

function SectionCardItem({
  card,
  isEditing,
  devices,
  roomsByHome,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !isEditing,
  });

  // getEffectiveCardSpan guards against a stale/manually-dragged 'small'
  // span on a kind that can't render as a quarter-width tile (media,
  // camera, sensor, room, scene) — those always render at least 'medium'
  // regardless of what's persisted.
  const span = getEffectiveCardSpan(card.kind, card.span ?? getDefaultSpan(card.kind));
  const subtitle = card.entityName || card.description;
  const isCamera = normalizeKind(card.kind) === 'camera';
  const isClock = isClockKind(card.kind);
  const cameraDeviceId = isCamera && card.entityId ? card.entityId : undefined;
  const normalizedKind = normalizeKind(card.kind);
  const isCover = normalizedKind === 'cover';
  const isTileKind = normalizedKind === 'device' || normalizedKind === 'light';
  const isCompactDeviceCard = isTileKind && span === 'small';
  const canResize = isEditing && !isClock;
  const roomDevices = normalizedKind === 'room' && card.entityId
    ? devices.filter((device) => device.roomId === card.entityId)
    : [];
  const assignedDevice = card.entityId
    ? devices.find((device) => device.id === card.entityId)
    : undefined;
  const assignedRoomName = assignedDevice?.roomId
    ? (roomsByHome[assignedDevice.homeId] ?? []).find((room) => room.id === assignedDevice.roomId)?.name
    : undefined;
  const cardIsActive = assignedDevice ? isDeviceActive(assignedDevice) : false;
  const isActionable = Boolean(card.entityId)
    && !isEditing
    && (normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'action');

  return (
    <div
      key={card.id}
      ref={(element) => {
        setNodeRef(element);
        registerRowSpanRef(card.id, element);
      }}
      style={{
        containerType: 'inline-size',
        // card.rowSpan is a human-scale unit (1 = one compact-tile height);
        // convert to the grid's fine-grained 20px row tracks.
        // Tile-kind cards get a fixed uniform height so identical tiles
        // don't jitter a few pixels apart from a 1- vs 2-line title. But
        // it's a floor, never a hard cap: Math.max against the actually
        // measured height means content that genuinely needs more room
        // (long titles, font differences) still gets it instead of being
        // clipped by the card's own overflow-hidden background.
        gridRow: `span ${card.rowSpan ? card.rowSpan * COMPACT_TILE_ROW_SPAN : (isTileKind ? Math.max(rowSpan, COMPACT_TILE_ROW_SPAN) : rowSpan)}`,
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
      }}
      onClick={isCover || normalizedKind === 'action' ? undefined : (event) => { void handleCardAction(card, event); }}
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
        isCover && "w-full max-w-curtain-dashboard justify-self-start",
        isActionable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-depth-2",
        isDragging && "z-30 opacity-45",
        getSpanClass(span)
      )}
    >
      <CardPreview
        kind={card.kind}
        title={card.title || catalogLabel(card.kind)}
        subtitle={isCamera ? assignedRoomName : subtitle}
        span={span}
        icon={card.icon}
        isAssigned={Boolean(card.entityId)}
        isActive={cardIsActive}
        deviceId={cameraDeviceId}
        device={assignedDevice}
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
      />

      {processingCardId === card.id ? (
        <div className="pointer-events-none absolute right-3 top-3 z-30 grid h-7 w-7 place-items-center rounded-full border border-primary/20 bg-background/80 text-primary shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      ) : null}

      {isEditing ? (
        <div className={cn(
          "absolute z-20 flex items-center opacity-0 transition-opacity group-hover/card:opacity-100 [@media(hover:none)]:opacity-100",
          isCompactDeviceCard ? "right-1 top-1 gap-0.5" : "right-2 top-2 gap-1"
        )}>
          <span
            className={cn(
              "grid cursor-grab touch-none place-items-center rounded-xl bg-background/95 text-muted-foreground shadow-lg backdrop-blur-md active:cursor-grabbing",
              isCompactDeviceCard ? "h-6 w-6" : "h-9 w-9"
            )}
            title={t('dashboard.editor.sections.move_card')}
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className={isCompactDeviceCard ? "h-3 w-3" : "h-4 w-4"} />
          </span>
          <IconButton
            icon={Pencil}
            label={t('dashboard.editor.sections.edit_card')}
            onClick={(event) => {
              event.stopPropagation();
              openCardEditor(card);
            }}
            variant="default"
            size={isCompactDeviceCard ? "sm" : "md"}
            className="bg-background/95 shadow-lg backdrop-blur-md hover:text-primary"
          />
          <IconButton
            icon={Trash2}
            label={t('dashboard.editor.sections.remove_card')}
            onClick={(event) => {
              event.stopPropagation();
              removeCard(card.id);
            }}
            variant="danger"
            size={isCompactDeviceCard ? "sm" : "md"}
            className="bg-background/95 shadow-lg backdrop-blur-md"
          />
        </div>
      ) : null}

      {canResize ? (
        <CardResizeHandle
          span={span}
          label={t('dashboard.editor.sections.resize_card')}
          onResize={(nextSpan) => resizeCard(card.id, nextSpan)}
        />
      ) : null}
    </div>
  );
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();

  // Every section uses a strict 4-column inner grid (Home Assistant
  // Sections style), regardless of the section's own outer canvas width —
  // a section is capped at ~500px (see the root container below), so a
  // wider section just means more sections fit side by side, not a wider
  // internal grid.
  const innerColumns = 4;

  const catalogLabel = (kind: SectionCardKind) => t(getCatalogLabelKey(kind));

  const catalogDescription = (kind: SectionCardKind) => t(getCatalogDescriptionKey(kind));

  const devices = useDeviceSnapshotStore((state) => state.devices);
  const roomsByHome = useDeviceSnapshotStore((state) => state.roomsByHome);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<SectionCardCategory | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.appearance?.title || '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ id: string; status: 'success' | 'error' } | null>(null);
  const actionFeedbackTimerRef = useRef<number | null>(null);
  const { rowSpans, registerCard } = useMasonryRowSpans();
  const cardDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', rowSpan: 0, icon: 'lightbulb' });
  const [scenes, setScenes] = useState<AssignableScene[]>([]);
  const [automations, setAutomations] = useState<AssignableAutomation[]>([]);

  useEffect(() => () => {
    if (actionFeedbackTimerRef.current !== null) window.clearTimeout(actionFeedbackTimerRef.current);
  }, []);

  const showActionFeedback = (id: string, status: 'success' | 'error') => {
    if (actionFeedbackTimerRef.current !== null) window.clearTimeout(actionFeedbackTimerRef.current);
    setActionFeedback({ id, status });
    actionFeedbackTimerRef.current = window.setTimeout(() => {
      setActionFeedback((current) => current?.id === id ? null : current);
      actionFeedbackTimerRef.current = null;
    }, 2800);
  };

  const assignableDevices = getAssignableDevicesForSectionCard(normalizeKind(cardDraft.kind), devices);
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
    if (!isCatalogOpen && normalizeKind(cardDraft.kind) !== 'scene') return;

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
    if (!isCatalogOpen && normalizeKind(cardDraft.kind) !== 'scene') return;

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
      rowSpan: nextCard.rowSpan ?? 0,
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
      rowSpan: card.rowSpan ?? 0,
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
        rowSpan: isClockKind(cardDraft.kind) || cardDraft.rowSpan < 1 ? undefined : cardDraft.rowSpan,
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

  const saveTitle = () => {
    const nextTitle = draftTitle.trim() || t('dashboard.editor.sections.new_section');
    onUpdate?.({
      appearance: {
        ...config.appearance,
        title: nextTitle,
      },
    });
    setIsEditingTitle(false);
  };

  const handleCardAction = async (card: NormalizedSectionCardItem, event?: MouseEvent) => {
    event?.stopPropagation();
    if (isEditing || !card.entityId) return;

    const normalized = normalizeKind(card.kind);
    if (normalized === 'scene') {
      // One card, two possible targets: a HomePilot scene (plain id) or an
      // automation "routine" (id stored with the AUTOMATION_ENTITY_PREFIX).
      // Neither has an on/off state — a tap always just (re-)runs it.
      const isRoutine = isAutomationEntityId(card.entityId);
      const targetId = isRoutine ? stripAutomationEntityPrefix(card.entityId) : card.entityId;
      const url = isRoutine
        ? `${API_BASE_URL}/api/v1/automations/${encodeURIComponent(targetId)}/run`
        : `${API_BASE_URL}/api/v1/scenes/${encodeURIComponent(targetId)}/execute`;

      setProcessingCardId(card.id);
      try {
        const response = await apiFetch(url, { method: 'POST' });
        if (!response.ok) throw new Error(`SCENE_OR_ROUTINE_${response.status}`);
      } catch (error) {
        console.error('[SectionWidget] Failed to execute scene/routine card:', error);
      } finally {
        setProcessingCardId(null);
      }
      return;
    }


    if (normalized === 'action') {
      const device = devices.find((candidate) => candidate.id === card.entityId);
      if (!device) return;

      // Real Home Assistant `button` entities press; scenes imported as
      // devices (entity_id domain "scene.") activate instead — neither has
      // an on/off state, but they dispatch through different HA services.
      const command = canExecuteCommand(device, 'press')
        ? 'press'
        : canExecuteCommand(device, 'activate')
          ? 'activate'
          : null;
      if (!command) return;

      setProcessingCardId(card.id);
      setActionFeedback(null);
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
        if (!response.ok) throw new Error(`ACTION_BUTTON_${response.status}`);
        const updated = await response.json() as SnapshotDevice;
        upsertDevice(updated);
        showActionFeedback(card.id, 'success');
      } catch (error) {
        console.error('[SectionWidget] Failed to execute action-button card:', error);
        showActionFeedback(card.id, 'error');
      } finally {
        setProcessingCardId(null);
      }
      return;
    }

    if (normalized !== 'device' && normalized !== 'light') return;

    const device = devices.find((candidate) => candidate.id === card.entityId);
    if (!device) return;

    const active = isDeviceActive(device);
    const command = active ? 'turn_off' : 'turn_on';

    setProcessingCardId(card.id);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (response.ok) {
        // Apply the already-updated device from the command response immediately
        // instead of waiting on a second, heavier full-snapshot refetch — that
        // extra round trip was what kept the spinner visible for ~2s after the
        // device had already turned on. The WebSocket-driven background refresh
        // (see App.tsx) still reconciles the rest of the snapshot in the background.
        const updated = await response.json() as SnapshotDevice;
        upsertDevice(updated);
      }
    } catch (error) {
      console.error('[SectionWidget] Failed to execute card action:', error);
    } finally {
      setProcessingCardId(null);
    }
  };

  const executeSectionDeviceCommand = useCallback(async (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ): Promise<SnapshotDevice | null> => {
    const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: params ? { name: command, params } : command }),
    });

    if (!response.ok) return null;

    const updated = await response.json() as SnapshotDevice;
    upsertDevice(updated);
    return updated;
  }, [upsertDevice]);
  const handleMediaCardAction = async (card: NormalizedSectionCardItem, command: MediaPlayerCommand, params?: Record<string, unknown>) => {
    if (isEditing || !card.entityId) return;

    const device = devices.find((candidate) => candidate.id === card.entityId);
    if (!device) return;

    // Volume shows its own instant optimistic feedback in the card, so it
    // skips the processing lock — otherwise a rapid tap would sit disabled
    // for the whole round trip of a full snapshot refresh.
    const isVolumeChange = command === 'volume_set';
    if (!isVolumeChange) setProcessingCardId(card.id);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: params ? { name: command, params } : command }),
      });
      if (!response.ok) throw new Error(`MEDIA_COMMAND_${response.status}`);
      // Same fix as handleCardAction: apply the response device immediately
      // instead of blocking the spinner on a second full-snapshot refetch.
      const updated = await response.json() as SnapshotDevice;
      upsertDevice(updated);
    } catch (error) {
      console.error('[SectionWidget] Failed to execute media card action:', error);
    } finally {
      if (!isVolumeChange) setProcessingCardId(null);
    }
  };

  const renderCatalogPreview = (
    kind: NormalizedSectionCardKind,
    titleOverride?: string,
    spanOverride?: SectionCardSpan,
    iconOverride?: SectionCardIcon,
    deviceIdOverride?: string,
  ) => {
    const title = titleOverride || catalogLabel(kind);
    const span = spanOverride ?? getDefaultSpan(kind);
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
        "grid overflow-hidden rounded-section bg-background/40 transition-[height,width,max-width] duration-200",
        span === 'small' && (normalizedPreviewKind === 'device' || normalizedPreviewKind === 'light' ? "h-device-card-compact w-full max-w-[12rem] justify-self-center" : "h-section-card-sm w-full max-w-[12rem] justify-self-center"),
        span === 'medium' && !isCoverPreview && "h-section-card-md w-full max-w-form-md",
        span === 'medium' && isCoverPreview && "h-curtain-card w-full max-w-form-md justify-self-center",
        span === 'full' && "w-full",
        isCameraPreview ? 'h-60' : isClockPreview ? 'h-56' : isRoomPreview ? 'h-52' : isScenePreview ? 'h-44' : isCoverPreview && span === 'full' ? 'h-curtain-card-lg' : normalizedPreviewKind === 'media' ? 'h-media-card-preview' : span === 'full' ? 'h-40' : ''
      )}>
        <CardPreview
          kind={kind}
          title={title}
          subtitle={normalizedPreviewKind === 'cover' ? previewRoomName || catalogDescription(kind) : catalogDescription(kind)}
          span={span}
          icon={iconOverride ?? getDefaultIcon(kind)}
          isAssigned={Boolean(deviceIdOverride)}
          isActive={previewDevice ? isDeviceActive(previewDevice) : false}
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
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99990] flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
        onClick={() => setIsCatalogOpen(false)}
      >
        <div
          className="max-h-section-modal w-full max-w-5xl overflow-hidden rounded-panel border border-border/50 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
            <div>
              <p className="text-micro font-black uppercase tracking-label-ultra text-primary">
                {t('dashboard.editor.sections.add_card')}
              </p>
              <h3 className="mt-1 text-view-title font-black tracking-tight text-foreground">
                {t('dashboard.editor.sections.card_catalog_title')}
              </h3>
            </div>
            <IconButton
              icon={X}
              label={t('common.close')}
              onClick={() => setIsCatalogOpen(false)}
              variant="ghost"
              size="md"
            />
          </div>

          <div className="space-y-3 border-b border-border/40 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('dashboard.editor.sections.card_catalog_search')}
              icon={<Search className="h-4 w-4" />}
              className="h-11 border-border/50 bg-background/50 font-semibold placeholder:text-muted-foreground/55"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={catalogCategoryFilter === null ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setCatalogCategoryFilter(null)}
                className="h-8 rounded-full px-3 text-micro font-black uppercase tracking-control"
              >
                {t('dashboard.editor.sections.category_all')}
              </Button>
              {catalogCategories.map((category) => (
                <Button
                  key={category.key}
                  type="button"
                  variant={catalogCategoryFilter === category.key ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setCatalogCategoryFilter(category.key)}
                  className="h-8 rounded-full px-3 text-micro font-black uppercase tracking-control"
                >
                  {t(category.labelKey)}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-h-section-editor overflow-y-auto p-6">
            {filteredCatalog.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {filteredCatalog.map((item) => (
                  <Button
                    key={item.kind}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addCard(item)}
                    className="h-auto w-full flex-col items-stretch justify-start rounded-card border border-border/50 bg-background/30 p-3 text-left hover:border-primary/50 hover:bg-primary/5"
                  >
                    {renderCatalogPreview(item.kind, item.title, item.span, item.icon)}
                    <div className="px-2 pb-1 pt-3">
                      <span className="block text-body font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-caption font-medium leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-border/40 px-2 py-1 text-micro font-black uppercase tracking-control text-muted-foreground">
                        {t(`dashboard.editor.sections.card_size_${item.span}`)}
                      </span>
                    </div>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-body font-semibold text-muted-foreground">
                {t('dashboard.editor.sections.card_catalog_empty')}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const editorModal = editingCard ? (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[99999] grid place-items-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
      >
        <div
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-panel border border-border/60 bg-card shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-5 py-4">
            <div>
              <p className="text-caption font-black uppercase tracking-label text-muted-foreground">
                {t('dashboard.editor.sections.edit')}
              </p>
              <h3 className="text-panel-title font-black text-foreground">
                {t('dashboard.editor.sections.edit_card')}
              </h3>
            </div>

            <IconButton
              icon={X}
              label={t('common.close')}
              onClick={() => setEditingCardId(null)}
              variant="ghost"
              size="md"
            />
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {renderCatalogPreview(
              cardDraft.kind,
              cardDraft.title || (isClockKind(cardDraft.kind) ? t(getClockKindLabelKey(cardDraft.kind)) : catalogLabel(cardDraft.kind)),
              cardDraft.span,
              cardDraft.icon,
              normalizeKind(cardDraft.kind) === 'camera' || normalizeKind(cardDraft.kind) === 'cover' || normalizeKind(cardDraft.kind) === 'room' || normalizeKind(cardDraft.kind) === 'sensor' || normalizeKind(cardDraft.kind) === 'media' ? cardDraft.entityId : undefined,
            )}

            <Input
              label={t('dashboard.editor.sections.name')}
              value={cardDraft.title}
              onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
              className="h-12 rounded-2xl border-border/60 bg-background/60 px-4 font-semibold"
            />

            {isClockKind(cardDraft.kind) ? (
              <SearchableSelectField
                label={t('dashboard.editor.sections.clock_design')}
                value={cardDraft.kind}
                options={clockCardOptions.map((option) => ({
                  value: option.kind,
                  label: t(option.labelKey),
                }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || t(getClockKindLabelKey(nextKind)),
                  }));
                }}
              />
            ) : (
              <SearchableSelectField
                label={t('dashboard.editor.sections.card_type')}
                value={cardDraft.kind}
                options={cardKinds
                  .filter((kind) => !isClockKind(kind))
                  .map((kind) => ({
                    value: kind,
                    label: catalogLabel(kind),
                  }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: isBindableKind(nextKind) && normalizeKind(draft.kind) === normalizeKind(nextKind) ? draft.entityId : '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || catalogLabel(nextKind),
                  }));
                }}
              />
            )}

            <SearchableSelectField
              label={t('dashboard.editor.sections.card_size')}
              value={cardDraft.span}
              placement="down"
              options={isClockKind(cardDraft.kind)
                ? [{ value: 'full', label: t('dashboard.editor.sections.card_size_full') }]
                : [
                  ...(canUseCompactSpan(cardDraft.kind)
                    ? [{ value: 'small', label: t('dashboard.editor.sections.card_size_small', { count: innerColumns }) }]
                    : []),
                  { value: 'medium', label: t('dashboard.editor.sections.card_size_medium', { count: Math.max(1, Math.floor(innerColumns / 2)) }) },
                  { value: 'full', label: t('dashboard.editor.sections.card_size_full') },
                ]}
              onChange={(value) => setCardDraft((draft) => ({
                ...draft,
                span: isClockKind(draft.kind) ? 'full' : getEffectiveCardSpan(draft.kind, value as SectionCardSpan),
              }))}
            />

            {!isClockKind(cardDraft.kind) ? (
              <SearchableSelectField
                label={t('dashboard.editor.sections.card_height')}
                value={String(cardDraft.rowSpan)}
                placement="down"
                options={[
                  { value: '0', label: t('dashboard.editor.sections.card_height_auto') },
                  ...Array.from({ length: MAX_MANUAL_ROW_SPAN }, (_, index) => index + 1).map((rows) => ({
                    value: String(rows),
                    label: t('dashboard.editor.sections.card_height_rows', { count: rows }),
                  })),
                ]}
                onChange={(value) => setCardDraft((draft) => ({ ...draft, rowSpan: Number(value) }))}
              />
            ) : null}

            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <IconPicker
                value={cardDraft.icon}
                onChange={(icon) => setCardDraft((draft) => ({ ...draft, icon }))}
              />
            ) : null}

            {isBindableKind(cardDraft.kind) ? (
              <div className="space-y-2">
                {normalizeKind(cardDraft.kind) === 'scene' ? (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_scene')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...scenes.map((scene) => ({
                        value: scene.id,
                        label: scene.name,
                        description: t('dashboard.editor.sections.scene_option_tag'),
                      })),
                      ...automations.map((automation) => ({
                        value: `${AUTOMATION_ENTITY_PREFIX}${automation.id}`,
                        label: automation.enabled ? automation.name : `${automation.name} (${t('dashboard.editor.sections.routine_disabled')})`,
                        description: t('dashboard.editor.sections.routine_option_tag'),
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextName = isAutomationEntityId(selectedId)
                        ? automations.find((automation) => automation.id === stripAutomationEntityPrefix(selectedId))?.name
                        : scenes.find((scene) => scene.id === selectedId)?.name;
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextName || draft.title,
                      }));
                    }}
                  />
                ) : normalizeKind(cardDraft.kind) === 'room' ? (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_room')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...assignableRooms.map((room) => ({
                        value: room.id,
                        label: room.name,
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextRoom = assignableRooms.find((room) => room.id === selectedId);
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextRoom?.name || draft.title,
                      }));
                    }}
                  />
                ) : (
                  <SearchableSelectField
                    label={t('dashboard.editor.sections.assigned_device')}
                    value={cardDraft.entityId}
                    placeholder={t('dashboard.editor.sections.unassigned')}
                    options={[
                      { value: '', label: t('dashboard.editor.sections.unassigned') },
                      ...assignableDevices.map((device) => ({
                        value: device.id,
                        label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
                      })),
                    ]}
                    onChange={(selectedId) => {
                      const nextDevice = devices.find((device) => device.id === selectedId);
                      setCardDraft((draft) => ({
                        ...draft,
                        entityId: selectedId,
                        title: nextDevice?.name || draft.title,
                      }));
                    }}
                  />
                )}

                <p className="text-caption font-semibold text-muted-foreground">
                  {t('dashboard.editor.sections.assignment_note')}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-border/50 px-5 py-4">
            <Button type="button" onClick={() => setEditingCardId(null)} variant="secondary" size="md">
              {t('dashboard.editor.sections.cancel')}
            </Button>

            <Button type="button" onClick={saveCardEditor} variant="primary" size="md">
              {t('dashboard.editor.sections.save')}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const sectionGrid = (
    <div
      onClick={(event) => event.stopPropagation()}
      className="grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(20px,auto)] grid-flow-row-dense content-start items-start gap-2 overflow-visible pr-1"
      style={{ gridTemplateColumns: `repeat(${innerColumns}, minmax(0, 1fr))` }}
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
            "h-auto w-auto min-h-section-card-sm rounded-section border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary hover:bg-primary/10 [&>svg]:h-6 [&>svg]:w-6",
            cards.length === 0 ? "col-span-full" : "col-span-1"
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
      className={cn(
        "group/section relative flex min-h-fit w-full min-w-0 self-start flex-col overflow-visible px-widget-pad-x py-widget-pad-y text-left transition-all duration-200",
        // Home Assistant sections have no visible container in normal view —
        // just a title with tiles below. The dashed outline is an editing
        // affordance only, not a permanent "card" around every section.
        isEditing
          ? "rounded-field border-2 border-dashed border-border/70 bg-background/15 hover:border-primary/70 hover:bg-primary/5"
          : "border-2 border-transparent bg-transparent"
      )}
    >
      <div className="mb-4 flex min-w-0 items-center gap-2 pr-10">
        {showTitle ? (
          isEditingTitle ? (
            <Input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveTitle();
                if (event.key === 'Escape') {
                  setDraftTitle(config.appearance?.title || '');
                  setIsEditingTitle(false);
                }
              }}
              containerClassName="min-w-0 flex-1"
              className="h-10 border-primary/40 bg-background/70 text-body-lg font-black"
              aria-label={t('dashboard.editor.sections.edit_section_title')}
            />
          ) : (
            <>
              <h2 className="min-w-0 truncate text-dashboard-section-title-fluid font-black tracking-tight text-foreground">
                {title}
              </h2>
              <IconButton
                icon={Pencil}
                label={t('dashboard.editor.sections.edit_section_title')}
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftTitle(config.appearance?.title || title);
                  setIsEditingTitle(true);
                }}
                variant="default"
                size="sm"
              />
            </>
          )
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
