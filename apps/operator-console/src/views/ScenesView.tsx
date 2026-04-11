import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Loader2, PlayCircle, Monitor, LayoutGrid, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { SceneBuilderModal } from './SceneBuilderModal';
import ConfirmModal from './ConfirmModal';

interface Room {
  id: string;
  name: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  roomId: string | null;
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
  actions: SceneAction[];
}

const ScenesView: React.FC = () => {
  const { t } = useTranslation();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Get Homes first to get homeId
        const homesRes = await fetch(`${API_BASE_URL}/api/v1/homes`);
        const homes = await homesRes.json();
        if (homes.length > 0) {
          const hId = homes[0].id;
          setHomeId(hId);

          const [scenesRes, roomsRes, devicesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/v1/scenes`),
            fetch(`${API_BASE_URL}/api/v1/homes/${hId}/rooms`),
            fetch(`${API_BASE_URL}/api/v1/devices`)
          ]);

          setScenes(await scenesRes.json());
          setRooms(await roomsRes.json());
          setDevices(await devicesRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch scenes data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExecute = async (scene: Scene) => {
    setExecutingId(scene.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/scenes/${scene.id}/execute`, { method: 'POST' });
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
      const res = await fetch(`${API_BASE_URL}/api/v1/scenes/${id}`, { method: 'DELETE' });
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
    // Reload scenes
    fetch(`${API_BASE_URL}/api/v1/scenes`)
      .then(res => res.json())
      .then(setScenes);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-black uppercase tracking-widest">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between bg-card/30 p-4 rounded-3xl border border-border/10 backdrop-blur-sm">
        <div className="flex items-center gap-4 px-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <LayoutGrid className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black uppercase tracking-widest text-primary">{t('nav.scenes')}</span>
            <span className="text-xs text-muted-foreground font-medium">{scenes.length} {t('dashboard.scenes_defined', { defaultValue: 'Scenes defined' })}</span>
          </div>
        </div>
        <button 
          onClick={() => { setEditingScene(null); setShowBuilder(true); }}
          className="bg-primary text-primary-foreground px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          {t('dashboard.scene_create', { defaultValue: 'Create Scene' })}
        </button>
      </div>

      {scenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-muted/20 border-2 border-dashed border-border/20 rounded-[3rem]">
          <div className="p-6 bg-muted/40 rounded-full mb-6">
            <Monitor className="w-12 h-12 text-muted-foreground opacity-20" />
          </div>
          <h3 className="text-xl font-black tracking-tight mb-2">{t('scenes.empty_title', { defaultValue: 'No scenes found' })}</h3>
          <p className="text-muted-foreground max-w-sm text-sm font-medium mb-8">
            {t('scenes.empty_description', { defaultValue: 'Create persistent scenes to group multiple device actions into a single tap.' })}
          </p>
          <button 
            onClick={() => setShowBuilder(true)}
            className="text-primary font-black uppercase tracking-widest text-xs hover:underline"
          >
            {t('dashboard.scene_create', { defaultValue: 'Create your first scene' })}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map(scene => (
            <div key={scene.id} className="group relative bg-card border border-border/50 rounded-[2.5rem] p-6 pb-20 hover:border-primary/50 transition-all duration-300 shadow-xl hover:shadow-primary/5 flex flex-col gap-4 overflow-hidden">
              
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <h4 className="text-lg font-black tracking-tighter line-clamp-1">{scene.name}</h4>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                    {scene.roomId ? rooms.find(r => r.id === scene.roomId)?.name : t('dashboard.scene_global', { defaultValue: 'Global Context' })}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {scene.actions.slice(0, 3).map((action, i) => {
                  const device = devices.find(d => d.id === action.deviceId);
                  return (
                    <span key={i} className="text-[10px] font-bold bg-muted/50 px-2 py-1 rounded-lg text-muted-foreground">
                      {device?.name || 'Device'} → {action.command === 'turn_on' ? 'ON' : 'OFF'}
                    </span>
                  );
                })}
                {scene.actions.length > 3 && (
                  <span className="text-[10px] font-bold bg-muted/50 px-2 py-1 rounded-lg text-muted-foreground">
                    + {scene.actions.length - 3} {t('common.more', { defaultValue: 'more' })}
                  </span>
                )}
              </div>

              {/* Bottom Actions Overlay */}
              <div className="absolute bottom-6 left-6 right-6 flex gap-2">
                <button 
                  onClick={() => handleExecute(scene)}
                  disabled={executingId === scene.id}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
                    successId === scene.id 
                      ? "bg-emerald-500 text-white" 
                      : executingId === scene.id 
                      ? "bg-muted text-muted-foreground" 
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground shadow-sm shadow-primary/10"
                  )}
                >
                  {executingId === scene.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : successId === scene.id ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <PlayCircle className="w-4 h-4" />
                  )}
                  {successId === scene.id ? t('common.done', { defaultValue: 'DONE' }) : t('common.execute', { defaultValue: 'EXECUTE' })}
                </button>

                <div className="flex gap-1.5">
                  <button 
                    onClick={() => { setEditingScene(scene); setShowBuilder(true); }}
                    className="p-3.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-2xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeletingId(scene.id)}
                    className="p-3.5 bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
        title={t('scenes.delete_title', { defaultValue: 'Delete Scene?' })}
        description={t('scenes.delete_description', { defaultValue: 'This will permanently remove the scene. Individual devices will not be affected.' })}
        confirmText={t('common.delete', { defaultValue: 'Delete Scene' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        onClose={() => setDeletingId(null)}
        variant="danger"
      />

    </div>
  );
};

export default ScenesView;
