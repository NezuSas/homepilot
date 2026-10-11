import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { apiFetch, readApiError } from '../../lib/apiClient';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import type { TopologyHome as Home, TopologyRoom as Room } from './topologyPresentation';

export const TOPOLOGY_API_URL = `${API_BASE_URL}/api/v1`;

/** Loads the active home, its rooms and devices from the shared snapshot store. */
export function useTopologyData(userId: string | undefined) {
  const { t } = useTranslation();
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<SnapshotDevice[]>([]);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [topologyError, setTopologyError] = useState('');
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        await refreshSnapshot();
        if (!isMounted) return;
        const snapshot = useDeviceSnapshotStore.getState();
        if (snapshot.lastUpdatedAt === null) throw new Error(t('topology.load_error'));
        const home = snapshot.homes.find((candidate): candidate is Home => (
          typeof candidate.id === 'string'
          && typeof candidate.name === 'string'
          && typeof candidate.ownerId === 'string'
        ));
        setDevices(snapshot.devices);
        setTopologyError('');
        if (home) {
          setSelectedHome(home);
          if (home.ownerId === userId) {
            setRooms(snapshot.roomsByHome[home.id] ?? []);
          } else {
            // Preserve the per-home endpoint's ownership check for shared topologies.
            const response = await apiFetch(`${TOPOLOGY_API_URL}/homes/${home.id}/rooms`);
            if (!response.ok) throw new Error(await readApiError(response, t('topology.load_error')));
            const roomData = await response.json();
            if (isMounted) setRooms(Array.isArray(roomData) ? roomData : []);
          }
        }
      } catch (error_: unknown) {
        if (isMounted) setTopologyError(error_ instanceof Error ? error_.message : t('topology.load_error'));
      } finally {
        if (isMounted) setLoadingHomes(false);
      }
    };

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [userId, refreshSnapshot, t]);

  return {
    selectedHome,
    setSelectedHome,
    rooms,
    setRooms,
    devices,
    setDevices,
    loadingHomes,
    topologyError,
    setTopologyError,
  };
}
