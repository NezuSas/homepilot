import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, readApiError } from '../../lib/apiClient';
import { useDeviceSnapshotStore } from '../../stores/useDeviceSnapshotStore';
import { TOPOLOGY_API_URL } from './useTopologyData';
import { canManageHome } from './topologyViewModel';
import type { TopologyHome as Home } from './topologyPresentation';

interface Options {
  userId: string | undefined;
  setSelectedHome: Dispatch<SetStateAction<Home | null>>;
  setTopologyError: Dispatch<SetStateAction<string>>;
}

/** Inline rename flow for the active home. */
export function useTopologyHomeRename({ userId, setSelectedHome, setTopologyError }: Options) {
  const { t } = useTranslation();
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [homeNameDraft, setHomeNameDraft] = useState('');
  const [isRenamingHome, setIsRenamingHome] = useState(false);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  const beginHomeRename = (home: Home) => {
    if (!canManageHome(home, userId)) return;
    setEditingHomeId(home.id);
    setHomeNameDraft(home.name);
  };

  const cancelHomeRename = () => {
    if (isRenamingHome) return;
    setEditingHomeId(null);
    setHomeNameDraft('');
  };

  const handleRenameHome = async (event: FormEvent, home: Home) => {
    event.preventDefault();
    if (!canManageHome(home, userId) || !homeNameDraft.trim()) return;
    setIsRenamingHome(true);
    setTopologyError('');
    try {
      const res = await apiFetch(`${TOPOLOGY_API_URL}/homes/${encodeURIComponent(home.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: homeNameDraft.trim() }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('topology.rename_home_error')));
      const updatedHome = await res.json() as Home;
      setSelectedHome((currentHome) => currentHome?.id === updatedHome.id ? updatedHome : currentHome);
      cancelHomeRename();
      void refreshSnapshot({ force: true });
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('topology.rename_home_error'));
    } finally {
      setIsRenamingHome(false);
    }
  };

  return {
    editingHomeId,
    homeNameDraft,
    isRenamingHome,
    setHomeNameDraft,
    beginHomeRename,
    cancelHomeRename,
    handleRenameHome,
  };
}
