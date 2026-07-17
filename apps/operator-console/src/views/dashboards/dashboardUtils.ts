import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { generateId } from '../../utils/generateId';

const DASHBOARD_TABLET_CANVAS_MIN_WIDTH = 640;
const DASHBOARD_DESKTOP_CANVAS_MIN_WIDTH = 1024;
const DASHBOARD_MAX_SECTION_SPAN = 3;

/**
 * Resolves the canvas column count from the actual available content width.
 * The sidebar is excluded from this width, so desktop editing must not wait
 * for the full browser viewport to reach the desktop breakpoint. Zones flow
 * into these columns by array order, Home Assistant "Sections" style, instead
 * of being positioned at absolute coordinates.
 */
export function getDashboardSectionColumns(width: number): 1 | 2 | 3 {
  if (width > 0 && width < DASHBOARD_TABLET_CANVAS_MIN_WIDTH) return 1;
  if (width > 0 && width < DASHBOARD_DESKTOP_CANVAS_MIN_WIDTH) return 2;
  return 3;
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
  return device.type === 'media_player' || device.profile?.category === 'media';
}

/** Returns only HomePilot-local devices compatible with a dashboard card. */
export function getAssignableDevicesForSectionCard(kind: string, devices: SnapshotDevice[]): SnapshotDevice[] {
  const matchingDevices = kind === 'camera' ? devices.filter(isCameraDevice)
    : kind === 'cover' ? devices.filter(isCoverDevice)
      : kind === 'light' ? devices.filter(isLightDevice)
        : kind === 'sensor' ? devices.filter(isSensorDevice)
          : kind === 'media' ? devices.filter(isMediaPlayerDevice)
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
