import { type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, readApiError } from '../../lib/apiClient';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { TOPOLOGY_API_URL } from './useTopologyData';
import { canRunRoomDeviceCommand } from './topologyViewModel';

interface Options {
  devices: SnapshotDevice[];
  selectedRoomId: string | null;
  homeId: string | undefined;
  setDevices: Dispatch<SetStateAction<SnapshotDevice[]>>;
  setTopologyError: Dispatch<SetStateAction<string>>;
}

/** Executes a command on a device of the selected room and mirrors the result locally and in the snapshot store. */
export function useRoomDeviceCommand({ devices, selectedRoomId, homeId, setDevices, setTopologyError }: Options) {
  const { t } = useTranslation();
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  return async (deviceId: string, command: string, params?: Record<string, unknown>): Promise<SnapshotDevice | null> => {
    const device = devices.find(candidate => candidate.id === deviceId);
    if (!canRunRoomDeviceCommand(device, command, selectedRoomId, homeId)) return null;
    setTopologyError('');
    try {
      const res = await apiFetch(`${TOPOLOGY_API_URL}/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: params ? { name: command, params } : command }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('common.errors.operation_failed')));
      const updatedDevice = await res.json() as SnapshotDevice;
      setDevices((currentDevices) => currentDevices.map((currentDevice) => currentDevice.id === updatedDevice.id ? updatedDevice : currentDevice));
      upsertDevice(updatedDevice);
      return updatedDevice;
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
      return null;
    }
  };
}
