import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import type { DashboardWidget, DashboardWidgetConfig } from './types';
import { generateId } from '../../utils/generateId';

const DASHBOARD_SECTION_COLUMNS = 4;
const DASHBOARD_SECTION_START_Y = 2;
const DASHBOARD_SECTION_MIN_ROWS = 2;

/**
 * Resolves the visual grid for dashboard sections. Section cards can grow
 * independently, so each following row starts below the tallest section in
 * the previous row instead of relying on a fixed row offset.
 */
export function resolveDashboardSectionLayouts(
  widgets: DashboardWidget[],
  isEditing: boolean,
): Map<string, DashboardWidgetConfig['layout']> {
  const sections = widgets.filter((widget) => widget.type === 'section');
  const layouts = new Map<string, DashboardWidgetConfig['layout']>();
  let rowY = DASHBOARD_SECTION_START_Y;

  for (let rowStart = 0; rowStart < sections.length; rowStart += DASHBOARD_SECTION_COLUMNS) {
    const rowSections = sections.slice(rowStart, rowStart + DASHBOARD_SECTION_COLUMNS);
    const rowCount = rowSections.length;
    const effectiveColumnCount = rowCount < DASHBOARD_SECTION_COLUMNS
      ? Math.min(DASHBOARD_SECTION_COLUMNS, rowCount + 1)
      : DASHBOARD_SECTION_COLUMNS;
    const width = Math.floor(12 / effectiveColumnCount);
    const heights = rowSections.map((section) => {
      const cards = Array.isArray(section.config.extra?.cards) ? section.config.extra.cards : [];
      const internalItems = Math.max(1, cards.length + (isEditing ? 1 : 0));
      const internalRows = Math.ceil(internalItems / 2);

      return Math.max(
        section.config.layout.h,
        DASHBOARD_SECTION_MIN_ROWS,
        1 + internalRows * 3,
      );
    });

    rowSections.forEach((section, index) => {
      layouts.set(section.id, {
        x: index * width,
        y: rowY,
        w: width,
        h: heights[index],
      });
    });

    rowY += Math.max(...heights) + 1;
  }

  return layouts;
}

export function getDashboardSectionPlaceholderY(
  layouts: Map<string, DashboardWidgetConfig['layout']>,
): number {
  const bottom = Array.from(layouts.values()).reduce(
    (max, layout) => Math.max(max, layout.y + layout.h),
    DASHBOARD_SECTION_START_Y - 1,
  );

  return bottom + 1;
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
  
  return {
    layout: {
      x: config.layout?.x ?? 0,
      y: config.layout?.y ?? 0,
      w: config.layout?.w ?? 4,
      h: config.layout?.h ?? 4,
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
