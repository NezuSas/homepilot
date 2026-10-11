import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from './apiClient';
import { DEFAULT_INSTALLED_FEATURES, type InstalledFeatures } from './installedFeatures';

/** Reads the installer's options once a session exists; a failed read keeps every option on. */
export function useInstalledFeatures(authenticated: boolean): InstalledFeatures {
  const [features, setFeatures] = useState<InstalledFeatures>(DEFAULT_INSTALLED_FEATURES);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    apiFetch(API_ENDPOINTS.system.features)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const homeChat = (data as { homeChat?: unknown } | null)?.homeChat;
        if (!cancelled && typeof homeChat === 'boolean') setFeatures({ homeChat });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [authenticated]);

  return features;
}
