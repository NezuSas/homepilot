import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { isMomentaryPlcCommand, plcErrorKey, plcResponseError } from '../../../lib/plcUi';
import { isDeviceUnavailable } from '../../../lib/deviceAvailability';
import { apiFetch } from '../../../lib/apiClient';
import { API_BASE_URL } from '../../../config';
import { canExecuteCommand } from '../../../lib/deviceCapabilities';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { isDeviceActive } from '../dashboardUtils';
import type { MediaPlayerCommand } from './MediaPlayerCard';
import { executeDeviceActionTarget, getSceneOrRoutineUrl, isDeviceActionEntityId } from './sectionCardAssignments';
import { normalizeKind, type NormalizedSectionCardItem } from './sectionCardCatalog';
import { useMomentaryActionFeedback } from './useMomentaryActionFeedback';

interface SectionCardActionsOptions {
  devices: SnapshotDevice[];
  isEditing: boolean;
  upsertDevice: (device: SnapshotDevice) => void;
}

export function useSectionCardActions({ devices, isEditing, upsertDevice }: SectionCardActionsOptions) {
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const pulseLocks = useRef(new Set<string>());
  const { actionFeedback, clearActionFeedback, showActionFeedback } = useMomentaryActionFeedback();

  const handleCardAction = async (card: NormalizedSectionCardItem, event?: MouseEvent) => {
    event?.stopPropagation();
    if (isEditing || !card.entityId) return;

    const assignedDevice = devices.find(candidate => candidate.id === card.entityId);
    const plcPulse = isMomentaryPlcCommand(assignedDevice);
    const storedKind = normalizeKind(card.kind);
    const normalized = plcPulse && ['device', 'light', 'action'].includes(storedKind) ? 'action' : storedKind;
    if (normalized === 'scene') {
      // One card, two possible targets: a HomePilot scene (plain id) or an
      // automation "routine" (id stored with the AUTOMATION_ENTITY_PREFIX).
      // Neither has an on/off state — a tap always just (re-)runs it.
      const url = getSceneOrRoutineUrl(card.entityId);

      setProcessingCardId(card.id);
      try {
        const response = await apiFetch(url, { method: 'POST' });
        if (!response.ok) throw new Error(`SCENE_OR_ROUTINE_${response.status}`);
      } catch (error) {
        console.error('[SectionWidget] Failed to execute scene/routine card:', error);
      } finally {
        setProcessingCardId(null);
      }
      return;
    }


    if (normalized === 'action') {
      if (isDeviceActionEntityId(card.entityId)) {
        setProcessingCardId(card.id);
        clearActionFeedback();
        try {
          const updated = await executeDeviceActionTarget(card.entityId, apiFetch) as SnapshotDevice;
          upsertDevice(updated);
          showActionFeedback(card.id, 'success');
        } catch {
          showActionFeedback(card.id, 'error');
        } finally {
          setProcessingCardId(null);
        }
        return;
      }
      const device = devices.find((candidate) => candidate.id === card.entityId);
      if (!device) {
        setProcessingCardId(card.id);
        clearActionFeedback();
        try {
          const response = await apiFetch(getSceneOrRoutineUrl(card.entityId), { method: 'POST' });
          if (!response.ok) throw new Error(`ACTION_SCENE_OR_ROUTINE_${response.status}`);
          showActionFeedback(card.id, 'success');
        } catch (error) {
          console.error('[SectionWidget] Failed to execute action scene/routine:', error);
          showActionFeedback(card.id, 'error');
        } finally {
          setProcessingCardId(null);
        }
        return;
      }

      // Real Home Assistant `button` entities press; scenes imported as
      // devices (entity_id domain "scene.") activate instead — neither has
      // an on/off state, but they dispatch through different HA services.
      const command = canExecuteCommand(device, 'press')
        ? 'press'
        : canExecuteCommand(device, 'activate')
          ? 'activate'
          : null;
      if (!command) return;
      if (plcPulse && (pulseLocks.current.has(device.id) || isDeviceUnavailable(device))) return;
      if (plcPulse) pulseLocks.current.add(device.id);

      setProcessingCardId(card.id);
      clearActionFeedback();
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });
        if (!response.ok) throw new Error(plcPulse ? await plcResponseError(response) : 'ACTION_BUTTON_FAILED');
        const updated = await response.json() as SnapshotDevice;
        upsertDevice(updated);
        if (plcPulse && (updated.lastKnownState?.confirmation === 'reset_failed' || updated.lastKnownState?.error)) throw new Error(plcErrorKey(updated.lastKnownState.error ?? 'RESET_FAILED'));
        if (!plcPulse) showActionFeedback(card.id, 'success');
      } catch (error) {
        showActionFeedback(card.id, 'error', plcPulse ? error instanceof Error && error.message.startsWith('plc.errors.') ? error.message : plcErrorKey(undefined) : undefined);
      } finally {
        if (plcPulse) pulseLocks.current.delete(device.id);
        setProcessingCardId(null);
      }
      return;
    }

    if (normalized !== 'device' && normalized !== 'light') return;

    const device = devices.find((candidate) => candidate.id === card.entityId);
    if (!device) return;

    const active = isDeviceActive(device);
    const command = active ? 'turn_off' : 'turn_on';

    setProcessingCardId(card.id);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (response.ok) {
        // Apply the already-updated device from the command response immediately
        // instead of waiting on a second, heavier full-snapshot refetch — that
        // extra round trip was what kept the spinner visible for ~2s after the
        // device had already turned on. The WebSocket-driven background refresh
        // (see App.tsx) still reconciles the rest of the snapshot in the background.
        const updated = await response.json() as SnapshotDevice;
        upsertDevice(updated);
      }
    } catch (error) {
      console.error('[SectionWidget] Failed to execute card action:', error);
    } finally {
      setProcessingCardId(null);
    }
  };

  const executeSectionDeviceCommand = useCallback(async (
    deviceId: string,
    command: string,
    params?: Record<string, unknown>,
  ): Promise<SnapshotDevice | null> => {
    const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: params ? { name: command, params } : command }),
    });

    if (!response.ok) return null;

    const updated = await response.json() as SnapshotDevice;
    upsertDevice(updated);
    return updated;
  }, [upsertDevice]);
  const handleMediaCardAction = async (card: NormalizedSectionCardItem, command: MediaPlayerCommand, params?: Record<string, unknown>) => {
    if (isEditing || !card.entityId) return;

    const device = devices.find((candidate) => candidate.id === card.entityId);
    if (!device) return;

    // Volume shows its own instant optimistic feedback in the card, so it
    // skips the processing lock — otherwise a rapid tap would sit disabled
    // for the whole round trip of a full snapshot refresh.
    const isVolumeChange = command === 'volume_set';
    if (!isVolumeChange) setProcessingCardId(card.id);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: params ? { name: command, params } : command }),
      });
      if (!response.ok) throw new Error(`MEDIA_COMMAND_${response.status}`);
      // Same fix as handleCardAction: apply the response device immediately
      // instead of blocking the spinner on a second full-snapshot refetch.
      const updated = await response.json() as SnapshotDevice;
      upsertDevice(updated);
    } catch (error) {
      console.error('[SectionWidget] Failed to execute media card action:', error);
    } finally {
      if (!isVolumeChange) setProcessingCardId(null);
    }
  };

  return { processingCardId, actionFeedback, handleCardAction, handleMediaCardAction, executeSectionDeviceCommand };
}
