import { resolveCapabilitiesForDevice, capabilityCommandsForDevice } from '../../../../packages/devices/domain/CapabilityResolver';
import { getDeviceProfileForDevice } from '../../../../packages/devices/domain/deviceProfiles';
import type { Device } from '../../../../packages/devices/domain/types';
import type { DeviceControlCatalog } from '../../../../packages/cloud-gateway/application/DeviceControlCatalogProvider';
import type { EffectiveAction } from '../../../../packages/cloud-gateway/application/EffectiveActionsResolver';

/**
 * Enriquece el dispositivo con sus capacidades resueltas operacionalmente.
 * Incluye la definición completa de comandos y esquemas de parámetros.
 */
export function enrichDevice(device: Device): Device & { profile: ReturnType<typeof getDeviceProfileForDevice> } {
  const profile = getDeviceProfileForDevice(device);
  const resolvedCapabilities = resolveCapabilitiesForDevice(device);
  const enrichedCapabilities = resolvedCapabilities.map(cap => ({
    ...cap,
    commands: capabilityCommandsForDevice(device, cap.type)
  }));

  return {
    ...device,
    capabilities: enrichedCapabilities,
    profile
  };
}

/** Proyección pública de las acciones efectivas de un dispositivo. */
export function toEffectiveActionsView(deviceId: string, actions: ReadonlyArray<EffectiveAction>) {
  return {
    deviceId,
    actions: actions.map(({ key, displayName, semanticAction, controlType, visibility, safetyLevel, requiresConfirmation }) => ({
      key, displayName, semanticAction, controlType, visibility, safetyLevel, requiresConfirmation,
    })),
  };
}

/** Proyección pública del catálogo de control (omite la ruta de ejecución interna). */
export function toControlCatalogView(catalog: DeviceControlCatalog) {
  return { ...catalog, commands: catalog.commands.map((command) => ({
    key: command.key, displayName: command.displayName,
    implementationType: command.implementationType, controlType: command.controlType,
    visibility: command.visibility, safetyLevel: command.safetyLevel,
    requiresConfirmation: command.requiresConfirmation,
    executableInHomePilot: command.executableInHomePilot,
    dashboardEligible: command.dashboardEligible,
    ...(command.semanticAction ? { semanticAction: command.semanticAction } : {}),
  })) };
}
