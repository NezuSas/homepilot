import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { apiFetch } from './apiClient';
import { AUTOMATION_FAVORITES_STORAGE_KEY, readFavoriteIds, SCENE_FAVORITES_STORAGE_KEY } from './favorites';

export type FavoriteKind = 'scene' | 'automation';

const resources = {
  scene: {
    endpoint: `${API_BASE_URL}/api/v1/scenes/favorites`,
    legacyKey: SCENE_FAVORITES_STORAGE_KEY,
    idsKey: 'sceneIds',
  },
  automation: {
    endpoint: `${API_BASE_URL}/api/v1/automations/favorites`,
    legacyKey: AUTOMATION_FAVORITES_STORAGE_KEY,
    idsKey: 'automationIds',
  },
} as const;

/** Backend preferences are authoritative; browser storage is read only for a one-time migration. */
export function useUserFavorites(userId: string | null, resourceIds: string[], kind: FavoriteKind) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [settledScope, setSettledScope] = useState<string | null>(null);
  const favoritesRef = useRef<string[]>([]);
  const savingRef = useRef(false);
  const availableIds = resourceIds.join('\u0000');
  const resource = resources[kind];
  const ownerScope = JSON.stringify([userId, kind]);
  const favoritesOwner = useRef(ownerScope);
  const requestScope = JSON.stringify([userId, kind, availableIds]);
  const loadedForScope = loaded && settledScope === requestScope;

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    // Catalog refresh must not erase visible favorites; a different user must.
    if (favoritesOwner.current !== ownerScope) {
      favoritesRef.current = [];
      setFavorites([]);
      favoritesOwner.current = ownerScope;
    }
    setLoaded(false);
    setSettledScope(null);
    if (!userId) return;

    const refresh = async () => {
      if (savingRef.current) return;
      const currentRequest = ++requestId;
      try {
        const response = await apiFetch(resource.endpoint);
        if (!response.ok) return;
        const value: unknown = await response.json();
        if (cancelled || currentRequest !== requestId || !value || typeof value !== 'object') return;
        const stored = (value as Record<string, unknown>)[resource.idsKey];
        if (!Array.isArray(stored)) return;
        let ids = stored.filter((id): id is string => typeof id === 'string');

        if (availableIds) {
          const accessible = new Set(availableIds.split('\u0000'));
          const legacy = readFavoriteIds(resource.legacyKey).filter((id) => accessible.has(id));
          const merged = [...new Set([...ids, ...legacy])];
          if (merged.length > ids.length) {
            const migrated = await apiFetch(resource.endpoint, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [resource.idsKey]: merged }),
            });
            if (migrated.ok) {
              ids = await migrated.json() as string[];
              localStorage.removeItem(resource.legacyKey);
            }
          } else if (localStorage.getItem(resource.legacyKey) !== null) {
            localStorage.removeItem(resource.legacyKey);
          }
        }
        if (!cancelled && currentRequest === requestId) {
          favoritesRef.current = ids;
          setFavorites(ids);
          setLoaded(true);
        }
      } catch {
        // A failed backend request must not restore device-local data as authority.
      } finally {
        if (!cancelled && currentRequest === requestId) setSettledScope(requestScope);
      }
    };

    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, [userId, availableIds, resource, requestScope, ownerScope]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (!loadedForScope || savingRef.current) return;
    savingRef.current = true;
    const previous = favoritesRef.current;
    const next = previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id];
    favoritesRef.current = next;
    setFavorites(next);
    try {
      const response = await apiFetch(resource.endpoint, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [resource.idsKey]: next }),
      });
      if (!response.ok) throw new Error('Unable to save favorites');
      localStorage.removeItem(resource.legacyKey);
    } catch {
      favoritesRef.current = previous;
      setFavorites(previous);
    } finally {
      savingRef.current = false;
    }
  }, [loadedForScope, resource]);

  return {
    favorites: favoritesOwner.current === ownerScope ? favorites : [],
    toggleFavorite,
    loaded: loadedForScope,
    settled: !userId || settledScope === requestScope,
  };
}
