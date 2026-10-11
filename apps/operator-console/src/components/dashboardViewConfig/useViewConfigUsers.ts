import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { DashboardViewConfigTabData, ViewConfigUser } from './viewConfigModel';

/** Fetches the users listed in the visibility tab each time the modal opens or the tab changes. */
export function useViewConfigUsers(isOpen: boolean, tab: DashboardViewConfigTabData) {
  const [users, setUsers] = useState<ViewConfigUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingUsers(true);
    apiFetch(`${API_BASE_URL}/api/v1/admin/users`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [isOpen, tab]);

  return { users, loadingUsers };
}
