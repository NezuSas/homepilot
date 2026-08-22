import { canExecuteCommand } from '../../../lib/deviceCapabilities';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { isDeviceActive } from '../dashboardUtils';

export type DeviceToggleCommand = 'turn_on' | 'turn_off' | 'toggle';

export interface DeviceTogglePlan {
  command: DeviceToggleCommand;
  isActive: boolean;
  optimisticDevice: SnapshotDevice;
}

export interface DeviceToggleExecutionDependencies {
  sendCommand: (command: DeviceToggleCommand) => Promise<SnapshotDevice>;
  upsertDevice: (device: SnapshotDevice) => void;
}

/**
 * Creates a reversible local snapshot before sending a physical toggle
 * command. The actual command response remains the source of truth.
 */
export function createDeviceTogglePlan(device: SnapshotDevice): DeviceTogglePlan | null {
  const wasActive = isDeviceActive(device);
  const targetActive = !wasActive;
  const preferredCommand: DeviceToggleCommand = targetActive ? 'turn_on' : 'turn_off';

  const command = canExecuteCommand(device, preferredCommand)
    ? preferredCommand
    : canExecuteCommand(device, 'toggle')
      ? 'toggle'
      : null;

  if (!command) return null;

  const priorState = device.lastKnownState ?? {};
  const optimisticState: Record<string, unknown> = {
    ...priorState,
    on: targetActive,
    state: targetActive ? 'on' : 'off',
    isActive: targetActive,
  };

  if (!targetActive) {
    optimisticState.brightness = 0;
    optimisticState.level = 0;
  }

  return {
    command,
    isActive: targetActive,
    optimisticDevice: {
      ...device,
      lastKnownState: optimisticState,
    },
  };
}

/**
 * Applies the immediate visual state, then either reconciles it from the
 * command response or restores the exact previous device after a failure.
 */
export async function executeDeviceToggle(
  device: SnapshotDevice,
  dependencies: DeviceToggleExecutionDependencies,
): Promise<{ plan: DeviceTogglePlan | null; succeeded: boolean }> {
  const plan = createDeviceTogglePlan(device);
  if (!plan) return { plan: null, succeeded: false };

  dependencies.upsertDevice(plan.optimisticDevice);

  try {
    const updatedDevice = await dependencies.sendCommand(plan.command);
    dependencies.upsertDevice(updatedDevice);
    return { plan, succeeded: true };
  } catch {
    dependencies.upsertDevice(device);
    return { plan, succeeded: false };
  }
}
