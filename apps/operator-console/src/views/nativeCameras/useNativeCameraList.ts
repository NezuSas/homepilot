import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import type { NativeCamera } from './types';

/** Loads the native cameras of the active home and keeps the initial-loading flag honest. */
export function useNativeCameraList(activeHomeId: string | null) {
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const [cameras, setCameras] = useState<NativeCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCameras = useCallback(async (showSpinner = true) => {
    if (!activeHomeId) return;

    if (showSpinner) setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras?homeId=${encodeURIComponent(activeHomeId)}`);
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } catch (err) {
      console.error('Failed to load cameras', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [activeHomeId]);

  useEffect(() => {
    let active = true;
    void refreshSnapshot().finally(() => {
      if (active && useDeviceSnapshotStore.getState().homes.length === 0) setIsLoading(false);
    });
    return () => { active = false; };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (!activeHomeId) return;
    void loadCameras();
  }, [activeHomeId, loadCameras]);

  return { cameras, setCameras, isLoading, loadCameras };
}
