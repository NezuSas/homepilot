import type { SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { isDeviceUnavailable } from '../../lib/deviceAvailability';
import { resolveManagedDeviceKind } from '../../lib/devicePresentation';
import { getRoomDeviceState } from './topologyDeviceControl';

export interface RoomSceneState {
  /** True only when at least one light is known to be on. Unknown is not on. */
  lightsOn: boolean;
  /** Mean open percentage of the room's covers, or null when no position is known. Unknown is not closed. */
  curtainOpen: number | null;
}

const parsePercent = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : undefined;
};

/** Open percentage of one cover (0 closed, 100 open), or null when it is not known. */
export function getCoverOpenPercent(device: SnapshotDevice): number | null {
  const state = device.lastKnownState as Record<string, unknown> | null | undefined;
  if (!state || isDeviceUnavailable(device)) return null;
  const attributes = (state.attributes && typeof state.attributes === 'object' ? state.attributes : {}) as Record<string, unknown>;
  const position = parsePercent(state.current_position) ?? parsePercent(state.position)
    ?? parsePercent(attributes.current_position) ?? parsePercent(attributes.position);
  if (position !== undefined) return device.invertState ? 100 - position : position;
  const label = state.state;
  if (label !== 'open' && label !== 'closed') return null;
  const open = label === 'open';
  return (device.invertState ? !open : open) ? 100 : 0;
}

export function buildRoomSceneState(devices: SnapshotDevice[]): RoomSceneState {
  let lightsOn = false;
  const positions: number[] = [];
  for (const device of devices) {
    const kind = resolveManagedDeviceKind(device);
    if (kind === 'light' && getRoomDeviceState(device) === true) lightsOn = true;
    if (kind === 'cover') {
      const open = getCoverOpenPercent(device);
      if (open !== null) positions.push(open);
    }
  }
  return {
    lightsOn,
    curtainOpen: positions.length > 0 ? Math.round(positions.reduce((sum, value) => sum + value, 0) / positions.length) : null,
  };
}
