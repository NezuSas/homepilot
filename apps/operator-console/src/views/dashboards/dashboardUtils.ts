import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { canExecuteCommand } from '../../lib/deviceCapabilities';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { generateId } from '../../utils/generateId';

const DASHBOARD_MAX_SECTION_SPAN = 4;
// Must match DashboardCanvas's own grid-template-columns
// (repeat(auto-fit, minmax(350px, 1fr))) exactly. This JS count decides
// grid-column: span N for full-width items (the title bar, add-section
// placeholder), and a mismatch forces the browser to create an extra
// implicit column to satisfy that span — one that doesn't participate in
// the grid's wrapping and pushes content off-screen instead. Sections
// themselves have no max-width: the 1fr share in the CSS grid stretches
// them edge to edge on a wide monitor instead of leaving blank margins.
const DASHBOARD_SECTION_COLUMN_BASIS_PX = 350;
const DASHBOARD_SECTION_COLUMN_GAP_PX = 20;
const PORTRAIT_KIOSK_MIN_VIEWPORT_WIDTH = 1080;
const PORTRAIT_KIOSK_MIN_VIEWPORT_HEIGHT = 1280;
const PORTRAIT_KIOSK_MIN_ASPECT_RATIO = 1.3;
/**
 * Resolves the display name from the explicit authenticated user context.
 * Dashboard widgets must never inspect arbitrary browser storage because it
 * can surface a stale or unrelated identity.
 */
export function getDashboardUserDisplayName(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback;

  const context = value as Record<string, unknown>;
  const displayName = typeof context.displayName === 'string' ? context.displayName.trim() : '';
  const username = typeof context.username === 'string' ? context.username.trim() : '';

  return displayName || username || fallback;
}

/**
 * Resolves the canvas column count from the actual available content width.
 * The sidebar is excluded from this width, so desktop editing must not wait
 * for the full browser viewport to reach the desktop breakpoint. Zones flow
 * into these columns by array order, Home Assistant "Sections" style, instead
 * of being positioned at absolute coordinates.
 */
export function getDashboardSectionColumns(width: number): number {
  if (width <= 0) return 1;
  const columns = Math.floor(
    (width + DASHBOARD_SECTION_COLUMN_GAP_PX) / (DASHBOARD_SECTION_COLUMN_BASIS_PX + DASHBOARD_SECTION_COLUMN_GAP_PX)
  );
  return Math.max(1, columns);
}

/**
 * Identifies high-resolution portrait kiosks without treating conventional
 * phones or tablets as kiosks. Their available canvas can be wide enough for
 * three columns, but that makes controls too small at arm's length.
 */
export function isPortraitKioskViewport(viewportWidth: number, viewportHeight: number): boolean {
  if (viewportWidth < PORTRAIT_KIOSK_MIN_VIEWPORT_WIDTH || viewportHeight < PORTRAIT_KIOSK_MIN_VIEWPORT_HEIGHT) {
    return false;
  }

  return viewportHeight / viewportWidth >= PORTRAIT_KIOSK_MIN_ASPECT_RATIO;
}

/**
 * Preserves the normal canvas breakpoints while keeping each control legible
 * on a high-resolution portrait kiosk.
 */
export function getDashboardSectionColumnsForViewport(
  canvasWidth: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const columns = getDashboardSectionColumns(canvasWidth);
  return isPortraitKioskViewport(viewportWidth, viewportHeight) ? Math.min(columns, 2) : columns;
}

/**
 * Clamps a zone's column-span to whatever the current breakpoint can offer,
 * without mutating the persisted span so it is restored once the canvas
 * widens again.
 */
export function clampSectionSpan(span: number, columns: number): number {
  const safeColumns = Math.max(1, columns);
  return Math.max(1, Math.min(span, safeColumns));
}

/**
 * Reads a widget's column-span, deriving it from the legacy absolute-layout
 * width when a dashboard was persisted before the flow-based grid existed.
 */
export function getSectionSpan(widget: DashboardWidget): number {
  const explicitSpan = widget.config.layout.span;
  if (typeof explicitSpan === 'number' && Number.isFinite(explicitSpan)) {
    return Math.max(1, Math.min(Math.round(explicitSpan), DASHBOARD_MAX_SECTION_SPAN));
  }

  const legacyWidth = widget.config.layout.w;
  const derivedSpan = legacyWidth >= 12 ? 3 : legacyWidth >= 6 ? 2 : 1;
  return derivedSpan;
}

/**
 * Determines if a device is "Active" (ON, OPEN, or has BRIGHTNESS/VALUE)
 * based on the core system logic.
 */
export function isDeviceActive(device: SnapshotDevice): boolean {
  if (!device.lastKnownState) return false;
  
  const state = device.lastKnownState as Record<string, unknown>;
  
  // Power states
  if (state.on === true || state.state === 'on') return true;
  
  // Security/Proximity states
  if (state.open === true || state.isActive === true) return true;
  
  // Analog states
  if (typeof state.brightness === 'number' && state.brightness > 0) return true;
  if (typeof state.level === 'number' && state.level > 0) return true;
  
  return false;
}

/**
 * Filter devices by room ID.
 */
export function getDevicesInRoom(devices: SnapshotDevice[], roomId: string | null): SnapshotDevice[] {
  if (!roomId) return [];
  return devices.filter(d => d.roomId === roomId);
}

function isCameraDevice(device: SnapshotDevice) {
  return device.type === 'camera' || device.semanticType === 'camera';
}

function isCoverDevice(device: SnapshotDevice) {
  return device.type === 'cover' || device.semanticType === 'cover';
}

function isLightDevice(device: SnapshotDevice) {
  return device.type === 'light'
    || device.semanticType === 'light'
    || device.type === 'switch'
    || device.semanticType === 'switch'
    || device.type === 'outlet'
    || device.semanticType === 'outlet';
}

function isSensorDevice(device: SnapshotDevice) {
  return device.type === 'sensor'
    || device.type === 'binary_sensor'
    || device.semanticType === 'sensor';
}

function isMediaPlayerDevice(device: SnapshotDevice) {
  return !isCameraDevice(device)
    && (device.type === 'media_player'
      || device.profile?.type === 'media_player'
      || device.profile?.domain === 'media_player');
}

/** Returns only HomePilot-local devices compatible with a dashboard card. */
export function getAssignableDevicesForSectionCard(kind: string, devices: SnapshotDevice[]): SnapshotDevice[] {
  const matchingDevices = kind === 'camera' ? devices.filter(isCameraDevice)
    : kind === 'cover' ? devices.filter(isCoverDevice)
      : kind === 'light' ? devices.filter(isLightDevice)
        : kind === 'sensor' ? devices.filter(isSensorDevice)
          : kind === 'media' ? devices.filter(isMediaPlayerDevice)
            : kind === 'action' ? devices.filter((device) => canExecuteCommand(device, 'press') || canExecuteCommand(device, 'activate'))
            : kind === 'device'
              ? devices.filter((device) => !isCameraDevice(device) && !isSensorDevice(device) && !isMediaPlayerDevice(device))
              : [];

  return matchingDevices.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

/**
 * Ensures a widget config has all required fields with defaults.
 */
export function sanitizeWidgetConfig(config: Partial<DashboardWidgetConfig> = {}): DashboardWidgetConfig {
  // If the config is already fully populated and structured, we should avoid changing the reference
  // if possible. However, for safety and simplicity, we ensure all defaults are present.
  
  const rawSpan = config.layout?.span;
  const clampedSpan = typeof rawSpan === 'number' && Number.isFinite(rawSpan)
    ? Math.max(1, Math.min(Math.round(rawSpan), DASHBOARD_MAX_SECTION_SPAN))
    : undefined;

  return {
    layout: {
      x: config.layout?.x ?? 0,
      y: Math.max(0, config.layout?.y ?? 0),
      w: Math.max(1, Math.min(config.layout?.w ?? 4, 12)),
      h: Math.max(1, config.layout?.h ?? 4),
      span: clampedSpan,
    },
    binding: {
      entityId: config.binding?.entityId ?? '',
      entityType: config.binding?.entityType ?? 'device',
      entityName: config.binding?.entityName
    },
    visibility: {
      rules: config.visibility?.rules ?? [],
      defaultState: config.visibility?.defaultState ?? 'show'
    },
    appearance: {
      variant: config.appearance?.variant ?? 'glass',
      title: config.appearance?.title ?? '',
      showTitle: config.appearance?.showTitle ?? true,
      icon: config.appearance?.icon,
      colors: config.appearance?.colors
    },
    extra: config.extra ?? {}
  };
}

/**
 * Ensures a widget object is fully structurally valid.
 */
export function sanitizeWidget(widget: Partial<DashboardWidget>): DashboardWidget {
  return {
    id: widget.id || generateId(),
    type: widget.type || 'device_control',
    config: sanitizeWidgetConfig(widget.config)
  };
}
