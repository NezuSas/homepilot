import { useCallback, useEffect, useState } from 'react';
import { API_ENDPOINTS } from '../config';
import type { SetupStatus } from '../appShellTypes';
import { apiFetch } from './apiClient';
import type { SessionStatus } from './useSession';

async function readSetupStatus(response: Response): Promise<SetupStatus> {
  const contentType = response.headers.get('content-type');
  if (!response.ok || !contentType || !contentType.includes('application/json')) {
    throw new Error('BACKEND_ERROR');
  }
  return response.json() as Promise<SetupStatus>;
}

/**
 * Setup status of the installation. Before login it only detects the factory
 * state without users; once authenticated it reads the full status.
 */
export function useSetupStatus(status: SessionStatus) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [isBackendOffline, setIsBackendOffline] = useState(false);

  useEffect(() => {
    if (status !== 'unauthenticated') return;

    setLoadingSetup(true);
    fetch(API_ENDPOINTS.system.setupStatus)
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          setSetupStatus(null);
          setIsBackendOffline(false);
          return null;
        }
        return readSetupStatus(res);
      })
      .then(data => {
        if (data) {
          setSetupStatus(data);
          setIsBackendOffline(false);
        }
      })
      .catch(() => setIsBackendOffline(true))
      .finally(() => setLoadingSetup(false));
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    setLoadingSetup(true);
    apiFetch(API_ENDPOINTS.system.setupStatus)
      .then(readSetupStatus)
      .then(data => {
        setSetupStatus(data);
        setIsBackendOffline(false);
      })
      .catch(() => setIsBackendOffline(true))
      .finally(() => setLoadingSetup(false));
  }, [status]);

  const markOnboardingCompleted = useCallback(() => {
    setSetupStatus(previous => (previous ? { ...previous, requiresOnboarding: false } : null));
  }, []);

  return { setupStatus, loadingSetup, isBackendOffline, markOnboardingCompleted };
}
