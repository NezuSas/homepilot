import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, LayoutGrid, Loader2, Star } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { SceneBuilderModal } from './SceneBuilderModal';
import ConfirmModal from '../components/ConfirmModal';
import { ScenesEmptyState } from '../components/ScenesEmptyState';
import { ScenesGroup } from '../components/ScenesGroup';
import { ScenesHeader } from '../components/ScenesHeader';
import { AlertBanner } from '../components/ui/AlertBanner';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

interface Room {
  id: string;
  name: string;
}

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  description?: string;
  actions: SceneAction[];
}

const ScenesView: React.FC<{
  onActionExecute?: (label: string) => void;
}> = ({ onActionExecute }) => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<SnapshotDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // Local Stats
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('hp_fav_scenes');
    return saved ? JSON.parse(saved) : [];
  });
  const [recents, setRecents] = useState<string[]>(() => {
    const saved = localStorage.getItem('hp_recent_scenes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('hp_fav_scenes', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('hp_recent_scenes', JSON.stringify(recents));
  }, [recents]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const trackRecent = (id: string) => {
    setRecents(prev => {
      const filtered = prev.filter(r => r !== id);
      const next = [id, ...filtered].slice(0, 4);
      return next;
    });
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const homesRes = await apiFetch(`${API_BASE_URL}/api/v1/homes`);
        if (!homesRes.ok) throw new Error(await readApiError(homesRes, t('scenes.errors.load_failed')));
        const homes = await homesRes.json();
        if (Array.isArray(homes) && homes.length > 0) {
          const hId = homes[0].id;
          setHomeId(hId);

          const [scenesRes, roomsRes, devicesRes] = await Promise.all([
            apiFetch(`${API_BASE_URL}/api/v1/scenes`),
            apiFetch(`${API_BASE_URL}/api/v1/homes/${hId}/rooms`),
            apiFetch(`${API_BASE_URL}/api/v1/devices`)
          ]);

          if (!scenesRes.ok) throw new Error(await readApiError(scenesRes, t('scenes.errors.load_failed')));
          if (!roomsRes.ok) throw new Error(await readApiError(roomsRes, t('scenes.errors.load_failed')));
          if (!devicesRes.ok) throw new Error(await readApiError(devicesRes, t('scenes.errors.load_failed')));
          const [sceneData, roomData, deviceData] = await Promise.all([scenesRes.json(), roomsRes.json(), devicesRes.json()]);
          if (Array.isArray(sceneData)) setScenes(sceneData);
          if (Array.isArray(roomData)) setRooms(roomData);
          if (Array.isArray(deviceData)) setDevices(deviceData);
          setError('');
        } else {
          setError(t('scenes.errors.no_home'));
        }
      } catch (error_: unknown) {
        setError(error_ instanceof Error ? error_.message : t('scenes.errors.load_failed'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExecute = async (scene: Scene) => {
    setExecutingId(scene.id);
    trackRecent(scene.id);
    if (onActionExecute) onActionExecute(scene.name);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/scenes/${scene.id}/execute`, { method: 'POST' });
      if (res.ok) {
        setSuccessId(scene.id);
        setTimeout(() => setSuccessId(null), 2000);
      }
    } catch (e) {
      console.error('Execution failed', e);
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/scenes/${id}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        setScenes(prev => prev.filter(s => s.id !== id));
      }
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingScene(null);
    apiFetch(`${API_BASE_URL}/api/v1/scenes`)
      .then(async res => {
        if (!res.ok) throw new Error(await readApiError(res, t('scenes.errors.load_failed')));
        return res.json();
      })
      .then(data => { if (Array.isArray(data)) setScenes(data); })
      .catch((error_: unknown) => setError(error_ instanceof Error ? error_.message : t('scenes.errors.load_failed')));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-caption font-black uppercase tracking-widest">{t('common.processing')}</span>
      </div>
    );
  }

  const favoriteScenes = scenes.filter(s => favorites.includes(s.id));
  const recentScenes = scenes.filter(s => recents.includes(s.id) && !favorites.includes(s.id));
  const otherScenes = scenes.filter(s => !favorites.includes(s.id) && !recents.includes(s.id));

  const openCreateScene = () => {
    if (!homeId) {
      setError(t('scenes.errors.no_home'));
      return;
    }
    setEditingScene(null);
    setShowBuilder(true);
  };

  const openEditScene = (scene: Scene, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingScene(scene);
    setShowBuilder(true);
  };

  const openDeleteScene = (sceneId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingId(sceneId);
  };

  return (
    <div className="flex flex-col gap-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ScenesHeader sceneCount={scenes.length} onCreateScene={openCreateScene} />

      {error && <AlertBanner variant="danger" message={error} />}

      {scenes.length === 0 ? (
        <ScenesEmptyState onCreateScene={openCreateScene} />
      ) : (
        <div className="flex flex-col gap-16">
          <ScenesGroup
            title={t('scenes.favorites')}
            icon={Star}
            iconClassName="w-4 h-4 text-warning fill-current"
            scenes={favoriteScenes}
            rooms={rooms}
            favorites={favorites}
            executingId={executingId}
            successId={successId}
            onExecute={handleExecute}
            onToggleFavorite={toggleFavorite}
            onEdit={openEditScene}
            onDelete={openDeleteScene}
          />

          <ScenesGroup
            title={t('scenes.recents')}
            icon={Clock}
            iconClassName="w-4 h-4 text-primary"
            scenes={recentScenes}
            rooms={rooms}
            favorites={favorites}
            executingId={executingId}
            successId={successId}
            onExecute={handleExecute}
            onToggleFavorite={toggleFavorite}
            onEdit={openEditScene}
            onDelete={openDeleteScene}
          />

          <ScenesGroup
            title={t('scenes.all_scenes')}
            icon={LayoutGrid}
            iconClassName="w-4 h-4 text-muted-foreground"
            scenes={otherScenes}
            rooms={rooms}
            favorites={favorites}
            executingId={executingId}
            successId={successId}
            onExecute={handleExecute}
            onToggleFavorite={toggleFavorite}
            onEdit={openEditScene}
            onDelete={openDeleteScene}
          />
        </div>
      )}

      {showBuilder && homeId && (
        <SceneBuilderModal 
          onClose={() => { setShowBuilder(false); setEditingScene(null); }}
          onSaved={handleSaved}
          homeId={homeId}
          rooms={rooms}
          devices={devices}
          existingScene={editingScene}
        />
      )}

      <ConfirmModal 
        isOpen={!!deletingId}
        title={t('scenes.delete_title')}
        description={t('scenes.delete_description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onClose={() => setDeletingId(null)}
        variant="danger"
      />

    </div>
  );
};

export default ScenesView;
