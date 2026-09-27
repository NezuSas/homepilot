import type { DeviceCommandV1 } from '../../devices/domain/commands';
import type { Device } from '../../devices/domain/types';
import { CAPABILITY_DEFINITIONS, type CapabilityCommand } from '../../devices/domain/capabilities';
import { resolveCapabilitiesForDevice } from '../../devices/domain/CapabilityResolver';
import {
  parseBoardManifestV1,
  type BoardManifestV1,
  type ManifestControlType,
  type ManifestSafetyLevel,
  type ManifestVisibility,
} from './BoardManifestV1';

export interface EffectiveAction {
  readonly key: string;
  readonly displayName: string;
  readonly semanticAction: DeviceCommandV1;
  readonly controlType: ManifestControlType;
  readonly visibility: ManifestVisibility;
  readonly safetyLevel: ManifestSafetyLevel;
  readonly requiresConfirmation: boolean;
}

export class EffectiveActionsIdentityError extends Error {
  readonly code = 'EFFECTIVE_ACTIONS_DEVICE_MISMATCH';

  constructor() {
    super('EFFECTIVE_ACTIONS_DEVICE_MISMATCH');
    this.name = 'EffectiveActionsIdentityError';
  }
}

function localControlType(command: CapabilityCommand): ManifestControlType | null {
  if (!command.params || command.params.length === 0) return 'button';
  if (command.params.length !== 1) return null;

  const [parameter] = command.params;
  return parameter.type === 'number' && parameter.required === true
    && typeof parameter.min === 'number' && Number.isFinite(parameter.min)
    && typeof parameter.max === 'number' && Number.isFinite(parameter.max)
    && parameter.min <= parameter.max
    ? 'slider'
    : null;
}

/** Pure intersection: commercial manifest permission cannot grant local capability. */
export function resolveEffectiveActions(manifestInput: unknown, device: Device): ReadonlyArray<EffectiveAction> {
  const manifest: BoardManifestV1 = parseBoardManifestV1(manifestInput);
  if (manifest.homePilotDeviceId !== device.id) throw new EffectiveActionsIdentityError();

  // PENDING/inbox devices and devices without a real room assignment are not operational.
  if (device.status !== 'ASSIGNED' || !device.roomId?.trim()) return [];

  const localControls = new Map<DeviceCommandV1, ManifestControlType | null>();
  for (const capability of resolveCapabilitiesForDevice(device)) {
    for (const definition of CAPABILITY_DEFINITIONS[capability.type] ?? []) {
      const controlType = localControlType(definition);
      const previous = localControls.get(definition.name);
      localControls.set(
        definition.name,
        localControls.has(definition.name) && previous !== controlType ? null : controlType,
      );
    }
  }

  return manifest.actions
    .filter((action) => localControls.get(action.semanticAction) === action.controlType)
    .map((action): EffectiveAction => ({
      key: action.key,
      displayName: action.displayName,
      semanticAction: action.semanticAction,
      controlType: action.controlType,
      visibility: action.visibility,
      safetyLevel: action.safetyLevel,
      requiresConfirmation: action.requiresConfirmation,
    }))
    .sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
}
