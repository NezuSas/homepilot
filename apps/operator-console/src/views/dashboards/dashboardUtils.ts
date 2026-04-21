import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import type { DashboardWidget, DashboardWidgetConfig } from './types';

/**
 * Determinates if a device is "Active" (ON, OPEN, or has BRIGHTNESS/VALUE)
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

/**
 * Ensures a widget config has all required fields with defaults.
 */
export function sanitizeWidgetConfig(config: Partial<DashboardWidgetConfig> = {}): DashboardWidgetConfig {
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
    id: widget.id || crypto.randomUUID(),
    type: widget.type || 'device_control',
    config: sanitizeWidgetConfig(widget.config)
  };
}
