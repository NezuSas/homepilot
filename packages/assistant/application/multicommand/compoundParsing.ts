import { Device } from '../../../devices/domain/types';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { AssistantMultiCommandResult, MultiCommandAction } from '../ports/IntentInterpreterPort';
import type { AuthorizedScope } from './AuthorizedScope';
import { resolveTargets } from './targetResolution';
import { inferCommandFromSegment, isControllableDevice } from './textRules';

/** Handles "A y B y C": divides the prompt by connectors and resolves each segment's targets. */
export async function parseCompound(
  originalPrompt: string,
  normalized: string,
  connectors: string[],
  scope: AuthorizedScope,
  userId?: string
): Promise<AssistantMultiCommandResult> {
  // Convert "A y B y C" to array
  let text = normalized;

  // Simple naive split by the first connector found
  // A better approach splits by all connectors, but let's replace all connectors with a single token first
  const TOKEN = '|||';
  for (const c of connectors) {
    text = text.split(c).join(TOKEN);
  }

  const parts = text.split(TOKEN).map(s => s.trim()).filter(s => s.length > 0);

  if (parts.length < 2) {
    return { type: 'failure', message: 'No se encontraron múltiples acciones claras.' };
  }

  const actions: MultiCommandAction[] = [];
  let currentCommand: DeviceCommandV1 | null = null;

  const allDevices = await scope.getAuthorizedDevices(userId);
  const allRooms = await scope.getAuthorizedRooms(userId);

  for (const segment of parts) {
    const explicitCommand = inferCommandFromSegment(segment);
    if (explicitCommand) {
      currentCommand = explicitCommand;
    }

    if (!currentCommand) {
      return { type: 'failure', message: `No entendí qué hacer con: "${segment}"` };
    }

    // Resolve targets in segment
    const targetMatches = await resolveTargets(segment, allDevices, allRooms);

    if (targetMatches.type === 'clarificationRequired') {
      return targetMatches;
    }

    if (targetMatches.type === 'failure') {
      return targetMatches;
    }

    if (targetMatches.type === 'match') {
      const devices = targetMatches.devices.filter((d: Device) => isControllableDevice(d, currentCommand!));
      if (devices.length === 0) {
        return { type: 'failure', message: `No encontré dispositivos controlables para: "${segment}"` };
      }

      for (const d of devices) {
        actions.push({
          deviceId: d.id,
          command: currentCommand!,
          targetName: d.name
        });
      }
    }
  }

  return {
    type: 'success',
    intent: {
      type: 'multi_command',
      prompt: originalPrompt,
      actions,
      requiresConfirmation: true
    }
  };
}
