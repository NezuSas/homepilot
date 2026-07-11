import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  GripVertical,
  Home,
  Loader2,
  Maximize2,
  Monitor,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { CameraMediaFrame, type CameraFeedMode } from '../../../components/CameraMediaFrame';
import { CameraViewerModal } from '../../../components/CameraViewerModal';
import { useDeviceSnapshotStore } from '../../../stores/useDeviceSnapshotStore';
import type { DashboardWidgetConfig, WidgetType } from '../types';
import { isDeviceActive } from '../dashboardUtils';
import { IconPicker, getLucideIconComponent } from '../components/IconPicker';
import { DashboardSelect } from '../components/DashboardSelect';
import { ClockWidget, type ClockStyle } from './ClockWidget';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
  onUpdate?: (config: Partial<DashboardWidgetConfig>) => void;
}

type SectionCardKind =
  | 'device'
  | 'light'
  | 'cover'
  | 'camera'
  | 'room'
  | 'scene'
  | 'clock'
  | 'clock_digital'
  | 'clock_analog'
  | 'clock_premium'
  | 'clock_minimal'
  | 'energy'
  | 'assistant';

type NormalizedSectionCardKind = Exclude<SectionCardKind, 'clock'>;
type LegacySectionCardKind = SectionCardKind | 'system';
type SectionCardSpan = 'small' | 'medium' | 'full';
type SectionCardIcon = string;

interface SectionCardItem {
  id: string;
  kind: SectionCardKind;
  title: string;
  description?: string;
  widgetType?: WidgetType;
  entityId?: string;
  entityName?: string;
  span?: SectionCardSpan;
  icon?: SectionCardIcon;
}

interface NormalizedSectionCardItem extends Omit<SectionCardItem, 'kind'> {
  kind: NormalizedSectionCardKind;
}

interface CardDraft {
  title: string;
  kind: NormalizedSectionCardKind;
  entityId: string;
  span: SectionCardSpan;
  icon: SectionCardIcon;
}

const createId = () => `section-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const cardKinds: NormalizedSectionCardKind[] = [
  'light',
  'cover',
  'camera',
  'room',
  'scene',
  'clock_digital',
  'clock_analog',
  'clock_premium',
  'clock_minimal',
  'energy',
  'assistant',
];

function normalizeKind(kind: SectionCardKind): NormalizedSectionCardKind {
  return kind === 'clock' ? 'clock_digital' : kind;
}

function isClockKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'clock_digital' || normalized === 'clock_analog' || normalized === 'clock_premium' || normalized === 'clock_minimal';
}

function getDefaultSpan(kind: SectionCardKind): SectionCardSpan {
  const normalized = normalizeKind(kind);
  if (normalized === 'light' || normalized === 'device' || normalized === 'cover') return 'small';
  if (isClockKind(normalized)) return 'full';
  if (normalized === 'camera') return 'full';
  return 'medium';
}

const clockCardOptions: { kind: NormalizedSectionCardKind; style: ClockStyle; label: string }[] = [
  { kind: 'clock_premium', style: 'analog-classic', label: 'Analógico premium' },
  { kind: 'clock_digital', style: 'digital', label: 'Digital compacto' },
  { kind: 'clock_analog', style: 'minimal', label: 'Digital residencial' },
  { kind: 'clock_minimal', style: 'analog-minimal', label: 'Analógico minimal' },
];


function getCatalogFallbackLabel(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'Luz';
    case 'cover':
      return 'Cortina';
    case 'camera':
      return 'Cámara';
    case 'room':
      return 'Habitación';
    case 'scene':
      return 'Escena';
    case 'clock_digital':
      return 'Digital compacto';
    case 'clock_analog':
      return 'Digital residencial';
    case 'clock_premium':
      return 'Analógico premium';
    case 'clock_minimal':
      return 'Analógico minimal';
    case 'energy':
      return 'Energía';
    case 'assistant':
      return 'Asistente IA';
    case 'device':
    default:
      return 'Dispositivo';
  }
}

function getCatalogFallbackDescription(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'camera':
      return 'Vista en vivo / snapshot';
    case 'light':
      return 'Control rápido para luces.';
    case 'cover':
      return 'Control rápido para cortinas.';
    case 'room':
      return 'Resumen de habitación.';
    case 'scene':
      return 'Acceso directo a escena.';
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'Reloj para la sección.';
    case 'energy':
      return 'Resumen de energía.';
    case 'assistant':
      return 'Información del asistente.';
    case 'device':
    default:
      return 'Control rápido de dispositivo.';
  }
}

function getCatalogLabelKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'dashboard.editor.sections.catalog.light';
    case 'cover':
      return 'dashboard.editor.sections.catalog.cover';
    case 'camera':
      return 'dashboard.editor.sections.catalog.camera';
    case 'room':
      return 'dashboard.editor.sections.catalog.room';
    case 'scene':
      return 'dashboard.editor.sections.catalog.scene';
    case 'clock_digital':
      return 'dashboard.editor.sections.catalog.clock_digital';
    case 'clock_analog':
      return 'dashboard.editor.sections.catalog.clock_analog';
    case 'clock_premium':
      return 'dashboard.editor.sections.catalog.clock_premium';
    case 'clock_minimal':
      return 'dashboard.editor.sections.catalog.clock_minimal';
    case 'energy':
      return 'dashboard.editor.sections.catalog.energy';
    case 'assistant':
      return 'dashboard.editor.sections.catalog.assistant';
    case 'device':
    default:
      return 'dashboard.editor.sections.catalog.device';
  }
}

function getCatalogDescriptionKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'dashboard.editor.sections.catalog.light_description';
    case 'cover':
      return 'dashboard.editor.sections.catalog.cover_description';
    case 'camera':
      return 'dashboard.editor.sections.catalog.camera_description';
    case 'room':
      return 'dashboard.editor.sections.catalog.room_description';
    case 'scene':
      return 'dashboard.editor.sections.catalog.scene_description';
    case 'clock_digital':
      return 'dashboard.editor.sections.catalog.clock_digital_description';
    case 'clock_analog':
      return 'dashboard.editor.sections.catalog.clock_analog_description';
    case 'clock_premium':
      return 'dashboard.editor.sections.catalog.clock_premium_description';
    case 'clock_minimal':
      return 'dashboard.editor.sections.catalog.clock_minimal_description';
    case 'energy':
      return 'dashboard.editor.sections.catalog.energy_description';
    case 'assistant':
      return 'dashboard.editor.sections.catalog.assistant_description';
    case 'device':
    default:
      return 'dashboard.editor.sections.catalog.device_description';
  }
}

function getWidgetType(kind: SectionCardKind): WidgetType {
  switch (normalizeKind(kind)) {
    case 'room':
      return 'room_overview' as WidgetType;
    case 'scene':
      return 'scene_shortcut' as WidgetType;
    case 'energy':
      return 'energy_snapshot' as WidgetType;
    case 'assistant':
      return 'assistant_insight' as WidgetType;
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'clock_display' as WidgetType;
    case 'device':
    case 'light':
    case 'cover':
    case 'camera':
    default:
      return 'device_control' as WidgetType;
  }
}

function isBindableKind(kind: SectionCardKind) {
  const normalized = normalizeKind(kind);
  return normalized === 'device' || normalized === 'light' || normalized === 'cover' || normalized === 'camera';
}

function getDefaultIcon(kind: SectionCardKind): SectionCardIcon {
  switch (normalizeKind(kind)) {
    case 'light':
      return 'Lightbulb';
    case 'cover':
      return 'Blinds';
    case 'camera':
      return 'Camera';
    case 'room':
      return 'Home';
    case 'scene':
      return 'Sparkles';
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'Clock';
    case 'energy':
      return 'Zap';
    case 'assistant':
      return 'Bot';
    case 'device':
    default:
      return 'Power';
  }
}

function iconForIconKey(icon: SectionCardIcon) {
  return getLucideIconComponent(icon);
}

function normalizeCards(extra?: DashboardWidgetConfig['extra']): NormalizedSectionCardItem[] {
  const rawCards = Array.isArray(extra?.cards) ? extra.cards : [];

  return rawCards.flatMap((rawCard, index) => {
    const card = rawCard as Partial<NormalizedSectionCardItem> & Record<string, unknown>;
    const legacyKind = (card.kind as LegacySectionCardKind) || 'device';
    if (legacyKind === 'system') return [];
    const kind = normalizeKind(legacyKind);

    return [{
      id: typeof card.id === 'string' && card.id.trim() ? card.id : createId(),
      kind,
      title: typeof card.title === 'string' && card.title.trim()
        ? card.title
        : isClockKind(kind)
          ? getClockKindLabel(kind)
          : kind,
      description: typeof card.description === 'string' ? card.description : '',
      widgetType: (card.widgetType as WidgetType) || getWidgetType(kind),
      entityId: typeof card.entityId === 'string' ? card.entityId : undefined,
      entityName: typeof card.entityName === 'string' ? card.entityName : undefined,
      span: isClockKind(kind)
        ? 'full'
        : card.span === 'medium' || card.span === 'full' || card.span === 'small'
          ? card.span
          : getDefaultSpan(kind),
      icon: typeof card.icon === 'string' && card.icon.trim() ? card.icon : getDefaultIcon(kind),
      order: typeof card.order === 'number' ? card.order : index,
    }];
  });
}

function getSpanClass(span: SectionCardSpan) {
  switch (span) {
    case 'full':
      return 'col-span-1 sm:col-span-2 xl:col-span-4';
    case 'medium':
      return 'col-span-1 sm:col-span-2';
    case 'small':
    default:
      return 'col-span-1';
  }
}

function getRecommendedSectionHeight(currentHeight: number, cards: NormalizedSectionCardItem[]) {
  void currentHeight;
  if (cards.length === 0) return 3;

  const rows = cards.reduce((total, card) => {
    if (card.span === 'full') return total + 1;
    if (card.span === 'medium') return total + 0.5;
    return total + 0.25;
  }, 0);

  return Math.max(4, Math.ceil(rows * 2.2) + 2);
}

function getClockKindLabel(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'clock_digital':
      return 'Digital compacto';
    case 'clock_analog':
      return 'Digital residencial';
    case 'clock_minimal':
      return 'Analógico minimal';
    case 'clock_premium':
    default:
      return 'Analógico premium';
  }
}

function getClockStyleForKind(kind: SectionCardKind): ClockStyle {
  const normalized = normalizeKind(kind);
  const option = clockCardOptions.find((item) => item.kind === normalized);
  return option?.style ?? 'minimal';
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
    <div className="h-full min-h-[14rem] overflow-hidden rounded-[1.35rem]">
      <ClockWidget config={clockConfig} />
    </div>
  );
}


function isCameraLikeDevice(device: { type?: string | null; semanticType?: string | null }) {
  return device.type === 'camera' || device.semanticType === 'camera';
}

function isCoverLikeDevice(device: { type?: string | null; semanticType?: string | null }) {
  return device.type === 'cover' || device.semanticType === 'cover';
}

function isLightLikeDevice(device: { type?: string | null; semanticType?: string | null }) {
  return device.type === 'light'
    || device.semanticType === 'light'
    || device.type === 'switch'
    || device.semanticType === 'switch'
    || device.type === 'outlet'
    || device.semanticType === 'outlet';
}

function getAssignableDevicesForKind(
  kind: SectionCardKind,
  devices: Array<{ id: string; name?: string | null; type?: string | null; semanticType?: string | null }>
) {
  const normalized = normalizeKind(kind);

  if (normalized === 'camera') return devices.filter(isCameraLikeDevice);
  if (normalized === 'cover') return devices.filter(isCoverLikeDevice);
  if (normalized === 'light') return devices.filter(isLightLikeDevice);
  if (normalized === 'device') return devices.filter((device) => !isCameraLikeDevice(device));
  return [];
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
  const [session, setSession] = useState<CameraMediaSession | null>(null);
  const [hasFeedError, setHasFeedError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [feedMode, setFeedMode] = useState<CameraFeedMode>('stream');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

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
      setSession(payload);
      setFeedMode(payload.hlsPath ? 'hls' : 'stream');
      setIsConnecting(false);
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setHasFeedError(true);
      setIsConnecting(false);
    });

    return () => controller.abort();
  }, [deviceId]);

  if (isConnecting) {
    return (
      <div className="grid h-full w-full place-items-center bg-black/40 animate-pulse">
        <Camera className="h-8 w-8 text-white/30" />
      </div>
    );
  }

  if (hasFeedError || !session) {
    return (
      <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_90%_20%,rgba(234,88,12,0.25),transparent_16%),linear-gradient(135deg,rgba(234,88,12,0.24),rgba(18,18,18,0.95)_42%,rgba(8,8,8,0.98))]">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/25 text-white/70">
          <Camera className="h-9 w-9" />
        </div>
      </div>
    );
  }

  const streamUrl = absoluteSessionUrl(session.streamPath);
  const snapshotUrl = absoluteSessionUrl(session.snapshotPath);
  const hlsUrl = session.hlsPath ? absoluteSessionUrl(session.hlsPath) : undefined;

  return (
    <>
      <button
        type="button"
        className="relative h-full w-full overflow-hidden text-left"
        onClick={(event) => {
          event.stopPropagation();
          if (!hasFeedError) setIsViewerOpen(true);
        }}
        aria-label={`Abrir ${title} en pantalla completa`}
      >
        <CameraMediaFrame
          active={!isViewerOpen}
          hlsUrl={hlsUrl}
          streamUrl={streamUrl}
          snapshotUrl={snapshotUrl}
          preferredMode={feedMode}
          alt={title}
          className="h-full w-full object-cover"
          onModeChange={setFeedMode}
          onReady={() => { /* noop */ }}
          onFailure={() => setHasFeedError(true)}
        />
        <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg backdrop-blur-md">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>

      <CameraViewerModal
        isOpen={isViewerOpen}
        name={title}
        streamUrl={streamUrl}
        hlsUrl={hlsUrl}
        snapshotUrl={snapshotUrl}
        preferredMode={feedMode}
        onClose={() => setIsViewerOpen(false)}
      />
    </>
  );
}

// Legacy helper kept for editor preview only (not used in live render)
function _CameraMediaPlaceholder() {
  return (
    <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_90%_20%,rgba(234,88,12,0.25),transparent_16%),linear-gradient(135deg,rgba(234,88,12,0.24),rgba(18,18,18,0.95)_42%,rgba(8,8,8,0.98))]">
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
  deviceId,
}: {
  kind: SectionCardKind;
  title: string;
  subtitle?: string;
  span: SectionCardSpan;
  icon?: SectionCardIcon;
  isAssigned?: boolean;
  deviceId?: string;
}) {
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
      <div className="relative h-full min-h-[12rem] overflow-hidden rounded-[1.35rem] border border-border/40 bg-card shadow-sm">
        {deviceId ? (
          <SectionCameraCard deviceId={deviceId} title={title} />
        ) : (
          <_CameraMediaPlaceholder />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black text-foreground shadow-sm">
          <span className="mr-1 text-primary">●</span>
          En vivo
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow">
            {title}
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-white/75">
            {deviceId ? 'Vista en vivo / snapshot' : subtitle || 'Sin cámara asignada'}
          </p>
        </div>
      </div>
    );
  }

  if (normalized === 'energy') {
    return (
      <div className="flex h-full min-h-0 flex-col justify-between rounded-[1.35rem] border border-border/45 bg-card p-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Energía</span>
        <div>
          <span className="text-4xl font-black text-foreground">1.8</span>
          <span className="ml-1 text-sm font-black text-muted-foreground">kW</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-full w-[64%] rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (normalized === 'room') {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-border/45 bg-[radial-gradient(circle_at_90%_10%,hsl(var(--primary)/0.18),transparent_34%),hsl(var(--card))] p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <Home className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-border/50 bg-background/55 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Habitación
          </span>
        </div>
        <div className="mt-auto min-w-0">
          <span className="block line-clamp-2 text-lg font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Acceso por estancia
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="rounded-2xl border border-border/45 bg-background/35 px-3 py-2">
            <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Vista</span>
            <span className="mt-1 block text-sm font-black text-foreground">Room</span>
          </span>
          <span className="rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2">
            <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-primary/70">Control</span>
            <span className="mt-1 block text-sm font-black text-primary">Local</span>
          </span>
        </div>
      </div>
    );
  }

  if (normalized === 'scene') {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/45 bg-gradient-to-br from-primary/15 to-card p-4 text-center">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-primary/30 text-primary">
          <Monitor className="h-6 w-6" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Escena</span>
        <span className="mt-3 text-sm font-black text-foreground">{title}</span>
      </div>
    );
  }

  if (normalized === 'assistant') {
    return (
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-border/45 bg-[radial-gradient(circle_at_85%_20%,hsl(var(--primary)/0.18),transparent_30%),hsl(var(--card))] p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary shadow-inner">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-border/45 bg-background/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            IA
          </span>
        </div>
        <div className="mt-auto min-w-0">
          <span className="block line-clamp-2 text-sm font-black leading-tight text-foreground">{title}</span>
          <span className="mt-1 block line-clamp-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Resumen inteligente
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            <span>Señales</span>
            <span className="text-primary">Listo</span>
          </div>
          <div className="h-2 rounded-full bg-muted/70">
            <div className="h-full w-[88%] rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/45 bg-card p-4 text-center">
      <span className={cn("mb-3 grid place-items-center rounded-full bg-primary/10 text-primary", isSmall ? "h-16 w-16" : "h-24 w-24")}>
        <Icon className={cn(isSmall ? "h-9 w-9" : "h-14 w-14")} />
      </span>
      <span className="line-clamp-2 text-sm font-black leading-tight text-foreground">{title}</span>
      {!isSmall ? (
        <span className="mt-1 line-clamp-2 text-[10px] font-bold leading-tight text-muted-foreground">
          {subtitle || (isAssigned ? 'Asignado' : 'Sin asignar')}
        </span>
      ) : null}
    </div>
  );
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export function SectionWidget({ config, isEditing, onUpdate }: SectionWidgetProps) {
  const { t } = useTranslation();

  const catalogLabel = (kind: SectionCardKind) => {
    const key = getCatalogLabelKey(kind);
    const translated = t(key);
    return translated === key ? getCatalogFallbackLabel(kind) : translated;
  };

  const catalogDescription = (kind: SectionCardKind) => {
    const key = getCatalogDescriptionKey(kind);
    const translated = t(key);
    return translated === key ? getCatalogFallbackDescription(kind) : translated;
  };

  const devices = useDeviceSnapshotStore((state) => state.devices);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(config.appearance?.title || '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb' });

  const assignableDevices = getAssignableDevicesForKind(cardDraft.kind, devices);
  const selectedDevice = cardDraft.entityId ? devices.find((device) => device.id === cardDraft.entityId) : undefined;


  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;
  const cards = normalizeCards(config.extra);
  const editingCard = editingCardId ? cards.find((card) => card.id === editingCardId) : undefined;

  const catalogItems = useMemo(() => cardKinds.map((kind) => ({
    kind,
    title: catalogLabel(kind),
    description: catalogDescription(kind),
    widgetType: getWidgetType(kind),
    span: getDefaultSpan(kind),
    icon: getDefaultIcon(kind),
  })), [t]);

  const filteredCatalog = catalogItems.filter((item) => {
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
      span: card.span ?? getDefaultSpan(card.kind),
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
        title: cardDraft.title.trim() || selectedDevice?.name || catalogLabel(cardDraft.kind),
        description: catalogDescription(cardDraft.kind),
        widgetType: getWidgetType(cardDraft.kind),
        entityId: cardDraft.entityId || undefined,
        entityName: selectedDevice?.name,
        span: isClockKind(cardDraft.kind) ? 'full' : cardDraft.span,
        icon: cardDraft.icon,
      };
    });

    updateCards(nextCards);
    setEditingCardId(null);
  };

  const removeCard = (id: string) => {
    updateCards(cards.filter((card) => card.id !== id));
  };

  const moveCard = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const sourceIndex = cards.findIndex((card) => card.id === sourceId);
    const targetIndex = cards.findIndex((card) => card.id === targetId);

    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextCards = [...cards];
    const [moved] = nextCards.splice(sourceIndex, 1);
    if (!moved) return;
    nextCards.splice(targetIndex, 0, moved);

    updateCards(nextCards);
  };

  const moveCardToEnd = (sourceId: string) => {
    const sourceIndex = cards.findIndex((card) => card.id === sourceId);
    if (sourceIndex < 0 || sourceIndex === cards.length - 1) return;

    const nextCards = [...cards];
    const [moved] = nextCards.splice(sourceIndex, 1);
    if (!moved) return;

    nextCards.push(moved);
    updateCards(nextCards);
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

  const handleCardAction = async (card: NormalizedSectionCardItem, event: MouseEvent) => {
    event.stopPropagation();
    if (isEditing || !card.entityId) return;

    const normalized = normalizeKind(card.kind);
    if (normalized !== 'device' && normalized !== 'light' && normalized !== 'cover') return;

    const device = devices.find((candidate) => candidate.id === card.entityId);
    if (!device) return;

    const active = isDeviceActive(device);
    const command = isCoverLikeDevice(device)
      ? active ? 'close' : 'open'
      : active ? 'turn_off' : 'turn_on';

    setProcessingCardId(card.id);
    try {
      await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      await refreshSnapshot();
    } catch (error) {
      console.error('[SectionWidget] Failed to execute card action:', error);
    } finally {
      setProcessingCardId(null);
    }
  };

  const renderCard = (card: NormalizedSectionCardItem) => {
    const span = card.span ?? getDefaultSpan(card.kind);
    const subtitle = card.entityName || card.description;
    const isCamera = normalizeKind(card.kind) === 'camera';
    const isClock = isClockKind(card.kind);
    const cameraDeviceId = isCamera && card.entityId ? card.entityId : undefined;
    const normalizedKind = normalizeKind(card.kind);
    const isActionable = Boolean(card.entityId)
      && !isEditing
      && (normalizedKind === 'device' || normalizedKind === 'light' || normalizedKind === 'cover');
    return (
      <div
        key={card.id}
        draggable={isEditing}
        onDragStart={(event) => {
          event.stopPropagation();
          setDraggingCardId(card.id);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', card.id);
        }}
        onDragOver={(event) => {
          if (!isEditing || !draggingCardId || draggingCardId === card.id) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragEnter={(event) => {
          if (!isEditing || !draggingCardId || draggingCardId === card.id) return;
          event.preventDefault();
          event.stopPropagation();
          moveCard(draggingCardId, card.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = event.dataTransfer.getData('text/plain') || draggingCardId;
          if (sourceId) moveCard(sourceId, card.id);
          setDraggingCardId(null);
        }}
        onDragEnd={() => setDraggingCardId(null)}
        onClick={(event) => { void handleCardAction(card, event); }}
        className={cn(
          "group/card relative min-h-[10.5rem] overflow-hidden rounded-[1.35rem] shadow-sm transition-all",
          isCamera && "min-h-[12rem]",
          isClock && "min-h-[14rem]",
          isActionable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-depth-2",
          draggingCardId === card.id && "opacity-45",
          getSpanClass(span)
        )}
      >
        <CardPreview
          kind={card.kind}
          title={card.title}
          subtitle={subtitle}
          span={span}
          icon={card.icon}
          isAssigned={Boolean(card.entityId)}
          deviceId={cameraDeviceId}
        />

        {processingCardId === card.id ? (
          <div className="absolute inset-0 z-30 grid place-items-center rounded-[inherit] bg-background/55 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}

        {isEditing ? (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
            <span
              className="grid h-8 w-8 cursor-grab place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg active:cursor-grabbing"
              title="Mover tarjeta"
              onClick={(event) => event.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openCardEditor(card);
              }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg transition hover:text-primary"
              aria-label="Edit card"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeCard(card.id);
              }}
              className="grid h-8 w-8 place-items-center rounded-xl bg-background/90 text-muted-foreground shadow-lg transition hover:text-destructive"
              aria-label="Remove card"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    );
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

    return (
      <div className={cn(
        "overflow-hidden rounded-[1.5rem] bg-background/40 transition-[height,width,max-width] duration-200",
        span === 'small' && "h-[10.5rem] w-full max-w-[13rem]",
        span === 'medium' && "h-[10.5rem] w-full max-w-[26rem]",
        span === 'full' && "w-full",
        isCameraPreview ? 'h-60' : isClockPreview ? 'h-56' : span === 'full' ? 'h-40' : ''
      )}>
        <CardPreview
          kind={kind}
          title={title}
          subtitle={catalogDescription(kind)}
          span={span}
          icon={iconOverride ?? getDefaultIcon(kind)}
          isAssigned={Boolean(deviceIdOverride)}
          deviceId={deviceIdOverride}
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
          className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/50 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-border/40 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
                {t('dashboard.editor.sections.add_card')}
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground">
                {t('dashboard.editor.sections.card_catalog_title')}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsCatalogOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/50 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('dashboard.editor.sections.card_catalog_search')}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/55"
              />
            </div>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-6">
            {filteredCatalog.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => addCard(item)}
                    className="rounded-[1.75rem] border border-border/50 bg-background/30 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    {renderCatalogPreview(item.kind, item.title, item.span, item.icon)}
                    <div className="px-2 pb-1 pt-3">
                      <span className="block text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-border/40 px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                        {t(`dashboard.editor.sections.card_size_${item.span}`)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm font-semibold text-muted-foreground">
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
        className="fixed inset-0 z-[99999] grid place-items-center bg-black/55 px-4 backdrop-blur-sm"
        onClick={() => setEditingCardId(null)}
      >
        <div
          className="w-full max-w-xl rounded-[2rem] border border-border/60 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Editar
              </p>
              <h3 className="text-xl font-black text-foreground">
                Editar tarjeta
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setEditingCardId(null)}
              className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            {renderCatalogPreview(
              cardDraft.kind,
              cardDraft.title || (isClockKind(cardDraft.kind) ? getClockKindLabel(cardDraft.kind) : catalogLabel(cardDraft.kind)),
              cardDraft.span,
              cardDraft.icon,
              normalizeKind(cardDraft.kind) === 'camera' ? cardDraft.entityId : undefined,
            )}

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                Nombre
              </span>
              <input
                value={cardDraft.title}
                onChange={(event) => setCardDraft((draft) => ({ ...draft, title: event.target.value }))}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              />
            </label>

            {isClockKind(cardDraft.kind) ? (
              <DashboardSelect
                label="Diseño de reloj"
                value={cardDraft.kind}
                options={clockCardOptions.map((option) => ({
                  value: option.kind,
                  label: option.label,
                }))}
                onChange={(value) => {
                  const nextKind = value as NormalizedSectionCardKind;
                  setCardDraft((draft) => ({
                    ...draft,
                    kind: nextKind,
                    entityId: '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || getClockKindLabel(nextKind),
                  }));
                }}
              />
            ) : (
              <DashboardSelect
                label="Tipo de tarjeta"
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
                    entityId: isBindableKind(nextKind) ? draft.entityId : '',
                    span: getDefaultSpan(nextKind),
                    icon: getDefaultIcon(nextKind),
                    title: draft.title || catalogLabel(nextKind),
                  }));
                }}
              />
            )}

            <DashboardSelect
              label={t('dashboard.editor.sections.card_size')}
              value={cardDraft.span}
              placement="down"
              options={isClockKind(cardDraft.kind)
                ? [{ value: 'full', label: t('dashboard.editor.sections.card_size_full') }]
                : [
                  { value: 'small', label: t('dashboard.editor.sections.card_size_small') },
                  { value: 'medium', label: t('dashboard.editor.sections.card_size_medium') },
                  { value: 'full', label: t('dashboard.editor.sections.card_size_full') },
                ]}
              onChange={(value) => setCardDraft((draft) => ({
                ...draft,
                span: isClockKind(draft.kind) ? 'full' : value as SectionCardSpan,
              }))}
            />

            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <IconPicker
                value={cardDraft.icon}
                onChange={(icon) => setCardDraft((draft) => ({ ...draft, icon }))}
              />
            ) : null}

            {isBindableKind(cardDraft.kind) ? (
              <div className="space-y-2">
                <DashboardSelect
                  label="Dispositivo asignado"
                  value={cardDraft.entityId}
                  placeholder="Sin asignar"
                  options={[
                    { value: '', label: 'Sin asignar' },
                    ...assignableDevices.map((device) => ({
                      value: device.id,
                      label: `${device.name} · ${device.type || device.semanticType || 'device'}`,
                    })),
                  ]}
                  onChange={(selectedId) => {
                    const selectedDevice = devices.find((device) => device.id === selectedId);
                    setCardDraft((draft) => ({
                      ...draft,
                      entityId: selectedId,
                      title: selectedDevice?.name || draft.title,
                    }));
                  }}
                />

                <p className="text-xs font-semibold text-muted-foreground">
                  Esta asignación queda guardada dentro de la tarjeta de la sección.
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-border/50 px-5 py-4">
            <button
              type="button"
              onClick={() => setEditingCardId(null)}
              className="rounded-2xl border border-border/50 px-5 py-2.5 text-sm font-black text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={saveCardEditor}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  ) : null;

  const sectionGrid = (
    <div
      onClick={(event) => event.stopPropagation()}
      onDragOver={(event) => {
        if (!isEditing || !draggingCardId) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDrop={(event) => {
        if (!isEditing || !draggingCardId) return;
        event.preventDefault();
        event.stopPropagation();
        const sourceId = event.dataTransfer.getData('text/plain') || draggingCardId;
        if (sourceId) moveCardToEnd(sourceId);
        setDraggingCardId(null);
      }}
      className="grid min-h-0 flex-1 grid-cols-1 auto-rows-[minmax(10.5rem,auto)] content-start gap-3 overflow-visible pr-1 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map(renderCard)}

      {isEditing ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsCatalogOpen(true);
          }}
          className={cn(
            "inline-flex min-h-[10.5rem] items-center justify-center rounded-[1.35rem] border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 hover:bg-primary/10",
            cards.length === 0 ? "col-span-1 sm:col-span-2 xl:col-span-4" : "col-span-1"
          )}
          aria-label={t('dashboard.editor.sections.add_card')}
        >
          <Plus className="h-6 w-6" />
        </button>
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
          <h2 className="min-w-0 truncate text-[clamp(1.35rem,2.5cqi,1.85rem)] font-black tracking-tight text-foreground">
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
      className="group/section relative flex min-h-fit w-full min-w-0 self-start flex-col overflow-visible rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5"
    >
      <div className="mb-4 flex min-w-0 items-center gap-2 pr-10">
        {showTitle ? (
          isEditingTitle ? (
            <input
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
              className="min-w-0 flex-1 rounded-xl border border-primary/40 bg-background/70 px-3 py-1.5 text-base font-black text-foreground outline-none"
              aria-label={t('dashboard.editor.sections.edit_section_title')}
            />
          ) : (
            <>
              <h2 className="min-w-0 truncate text-[clamp(1.35rem,2.5cqi,1.85rem)] font-black tracking-tight text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftTitle(config.appearance?.title || title);
                  setIsEditingTitle(true);
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border/40 bg-background/60 text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
                aria-label={t('dashboard.editor.sections.edit_section_title')}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">
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
