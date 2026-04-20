import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Plus, Edit2, Trash2, Loader2, Monitor, LayoutGrid, 
  Heart, Sun, Moon, Coffee, Zap, Clock, Star, Home, Leaf
} from 'lucide-react';
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
  description?: string;
  actions: SceneAction[];
}

const ScenesView: React.FC<{
  onActionExecute?: (label: string) => void;
}> = ({ onActionExecute }) => {
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
    trackRecent(scene.id);
    if (onActionExecute) onActionExecute(scene.name);
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
    fetch(`${API_BASE_URL}/api/v1/scenes`)
      .then(res => res.json())
      .then(setScenes);
  };

  const getSceneIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('morning') || n.includes('wake')) return Sun;
    if (n.includes('night') || n.includes('sleep') || n.includes('bed')) return Moon;
    if (n.includes('relax') || n.includes('chill')) return Coffee;
    if (n.includes('work') || n.includes('focus') || n.includes('office')) return Monitor;
    if (n.includes('welcome') || n.includes('home') || n.includes('arrive')) return Home;
    if (n.includes('eco') || n.includes('saving')) return Leaf;
    return Zap;
  };

  const getEmotionalDescription = (scene: Scene) => {
    if (scene.description) return scene.description;
    const n = scene.name.toLowerCase();
    if (n.includes('morning')) return t('scenes.descriptions.morning');
    if (n.includes('night')) return t('scenes.descriptions.night');
    if (n.includes('relax')) return t('scenes.descriptions.relax');
    if (n.includes('work')) return t('scenes.descriptions.work');
    if (n.includes('welcome')) return t('scenes.descriptions.welcome');
    return t('scenes.descriptions.generic');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-black uppercase tracking-widest">{t('common.processing')}</span>
      </div>
    );
  }

  const favoriteScenes = scenes.filter(s => favorites.includes(s.id));
  const recentScenes = scenes.filter(s => recents.includes(s.id) && !favorites.includes(s.id));
  const otherScenes = scenes.filter(s => !favorites.includes(s.id) && !recents.includes(s.id));

  const SceneCard = ({ scene }: { scene: Scene }) => {
    const Icon = getSceneIcon(scene.name);
    const room = scene.roomId ? rooms.find(r => r.id === scene.roomId) : null;
    const isFav = favorites.includes(scene.id);
    const emotionalDesc = getEmotionalDescription(scene);

    return (
      <div 
        onClick={() => handleExecute(scene)}
        className={cn(
          "group relative bg-card/40 backdrop-blur-2xl border-2 rounded-[3.5rem] p-8 transition-all duration-700 cursor-pointer overflow-hidden",
          successId === scene.id ? "border-primary bg-primary/5 premium-glow shadow-primary/10 scale-[1.02]" : "border-border/40 hover:border-primary/40",
          executingId === scene.id && "animate-premium-pulse"
        )}
      >
        <div className="flex items-start gap-8 relative z-10">
          <div className={cn(
            "p-6 rounded-[2.5rem] transition-all duration-700 transform group-hover:scale-110",
            successId === scene.id ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/40" : "bg-primary/10 text-primary group-hover:bg-primary/20"
          )}>
            {executingId === scene.id ? <Loader2 className="w-8 h-8 animate-spin" /> : <Icon className="w-8 h-8" />}
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0 pt-1">
            <h4 className="text-2xl font-black tracking-tighter truncate luxury-text-gradient">{scene.name}</h4>
            <p className="text-sm font-medium text-muted-foreground opacity-60 leading-tight">
              {emotionalDesc}
            </p>
            <div className="flex items-center gap-3 mt-4">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                 {room ? room.name : t('common.unknown')}
               </span>
               <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40">
                 {t('scenes.point_count', { count: scene.actions.length })}
               </span>
            </div>
          </div>
        </div>

        {/* Favorite Toggle */}
        <button 
          onClick={(e) => toggleFavorite(scene.id, e)}
          className={cn(
            "absolute top-8 right-8 p-3 rounded-full transition-all duration-300",
            isFav ? "text-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/20" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted"
          )}
        >
          <Heart className={cn("w-5 h-5", isFav && "fill-current")} />
        </button>

        {/* Action Overlay (Subtle Edit/Trash) */}
        <div className="absolute bottom-6 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
            <button 
              onClick={(e) => { e.stopPropagation(); setEditingScene(scene); setShowBuilder(true); }}
              className="p-3 bg-muted/40 hover:bg-muted border border-border/40 rounded-2xl hover:text-primary transition-all"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setDeletingId(scene.id); }}
              className="p-3 bg-muted/40 hover:bg-muted border border-border/40 rounded-2xl hover:text-destructive transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Search & Actions Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex flex-col">
          <h2 className="text-3xl font-black tracking-tighter">{t('nav.scenes')}</h2>
          <p className="text-xs font-bold text-muted-foreground opacity-50 uppercase tracking-widest mt-1">
             {t('scenes.header.available', { count: scenes.length })}
          </p>
        </div>
        <button 
          onClick={() => { setEditingScene(null); setShowBuilder(true); }}
          className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 premium-glow shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          {t('dashboard.scene_create')}
        </button>
      </div>

      {scenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center bg-card/10 border-4 border-dashed border-border/20 rounded-[4rem]">
          <div className="p-10 bg-muted/20 rounded-full mb-8">
            <Monitor className="w-16 h-16 text-muted-foreground opacity-20" />
          </div>
          <h3 className="text-2xl font-black tracking-tighter mb-4">{t('scenes.empty_title')}</h3>
          <p className="text-muted-foreground max-w-sm font-medium mb-12 opacity-60">
            {t('scenes.empty_description')}
          </p>
          <button 
            onClick={() => setShowBuilder(true)}
            className="group flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs"
          >
            {t('dashboard.scene_create')} <Zap className="w-4 h-4 group-hover:animate-bounce" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          
          {/* Favorites */}
          {favoriteScenes.length > 0 && (
            <div className="flex flex-col gap-6">
               <div className="flex items-center gap-3">
                  <Star className="w-4 h-4 text-warning fill-current" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{t('scenes.favorites')}</h3>
               </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.isArray(favoriteScenes) && favoriteScenes.map(s => <SceneCard key={s.id} scene={s} />)}
                </div>
            </div>
          )}

          {/* Recently Used */}
          {recentScenes.length > 0 && (
            <div className="flex flex-col gap-6">
               <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{t('scenes.recents')}</h3>
               </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.isArray(recentScenes) && recentScenes.map(s => <SceneCard key={s.id} scene={s} />)}
                </div>
            </div>
          )}

          {/* All Scenes */}
          <div className="flex flex-col gap-6">
             <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">{t('scenes.all_scenes')}</h3>
             </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(otherScenes) && otherScenes.map(s => <SceneCard key={s.id} scene={s} />)}
              </div>
          </div>

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
