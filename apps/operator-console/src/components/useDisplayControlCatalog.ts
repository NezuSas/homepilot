import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { parseDisplayControlCatalog, type DisplayControlCatalog } from './displayControlCatalog';

/** Both the configuration catalog and the room controller use the same validated contract. */
export function useDisplayControlCatalog(deviceId: string) {
  const [catalog, setCatalog] = useState<DisplayControlCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}/control-catalog`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Catalog unavailable');
        const parsed = parseDisplayControlCatalog(await response.json() as unknown, deviceId);
        if (!parsed) throw new Error('Invalid catalog');
        if (!controller.signal.aborted) setCatalog(parsed);
      }).catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [deviceId, reloadKey]);
  return { catalog: catalog?.deviceId === deviceId ? catalog : null, loading, loadError,
    retry: () => setReloadKey(key => key + 1) };
}
