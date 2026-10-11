import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { apiFetch } from './apiClient';
import type { DatabaseBackupSummary } from '../components/DatabaseBackupsCard';

/** Loads and creates database backups; the initial load only runs for administrators. */
export function useDatabaseBackups(isAdmin: boolean) {
  const [backups, setBackups] = useState<DatabaseBackupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [settled, setSettled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/system/backups`);
      if (!response.ok) throw new Error('BACKUP_LIST_ERROR');
      setBackups(await response.json() as DatabaseBackupSummary[]);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setSettled(true);
    }
  }, []);

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/system/backups`, { method: 'POST' });
      if (!response.ok) throw new Error('BACKUP_CREATE_ERROR');
      const created = await response.json() as DatabaseBackupSummary;
      setBackups(previous => [created, ...previous.filter(backup => backup.filename !== created.filename)]);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setCreating(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  return { backups, loading, creating, hasError, settled, load, create };
}
